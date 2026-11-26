package cl.sigo.patrolapp

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class SigoBackgroundService : Service(), LocationListener {

  companion object {
    const val CHANNEL_ID = "sigo_foreground_service"
    const val NOTIFICATION_ID = 1001
    const val PREFS_NAME = "sigo_bg_prefs"
    const val KEY_SESSION_ACTIVE = "session_active"
    const val KEY_API_URL = "api_url"
    const val KEY_TOKEN = "auth_token"
    const val KEY_LAST_LAT = "last_lat"
    const val KEY_LAST_LNG = "last_lng"
    const val KEY_LAST_ACC = "last_acc"
    const val KEY_LAST_SPEED = "last_speed"
    const val KEY_LAST_HEADING = "last_heading"
    const val KEY_LAST_ALT = "last_alt"
    const val KEY_LAST_MISSION_ID = "last_notified_mission_id"
    const val KEY_LAST_MSG_ID = "last_notified_msg_id"
    const val KEY_LAST_SOS_ACTIVA = "last_sos_activa"
    const val KEY_LAST_NOTIF_HASH = "last_notif_hash"
    const val KEY_LAST_NOTIF_TIME = "last_notif_time_ms"
  }

  private var wakeLock: PowerManager.WakeLock? = null
  private var locationManager: LocationManager? = null
  private var scheduler: ScheduledExecutorService? = null
  @Volatile private var latestLocation: Location? = null
  private var bgNotifIdCounter = 5000

  override fun onCreate() {
    super.onCreate()
    createServiceChannel()
    ensureAlertChannels()
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SIGO::PatrolBackgroundWakeLock")
    wakeLock?.acquire(12 * 60 * 60 * 1000L) // hasta 12 horas por turno
    startNativeLocationUpdates()
    startBackgroundTelemetryAndAlertsLoop()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildServiceNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    ensureAlertChannels()
    startNativeLocationUpdates()
    if (scheduler == null || scheduler?.isShutdown == true) {
      startBackgroundTelemetryAndAlertsLoop()
    }
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Si el funcionario cierra la app de recientes sin haber cerrado sesión,
    // el servicio sigue activo enviando GPS y recibiendo notificaciones hasta cerrar sesión.
    try {
      val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val active = prefs.getBoolean(KEY_SESSION_ACTIVE, false)
      val token = prefs.getString(KEY_TOKEN, null)
      if (active && !token.isNullOrBlank()) {
        val restartIntent = Intent(applicationContext, SigoBackgroundService::class.java)
        ContextCompat.startForegroundService(applicationContext, restartIntent)
      }
    } catch (_: Exception) {}
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    stopNativeLocationUpdates()
    try {
      scheduler?.shutdownNow()
      scheduler = null
    } catch (_: Exception) {}
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
    } catch (_: Exception) {}
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  @SuppressLint("MissingPermission")
  private fun startNativeLocationUpdates() {
    try {
      val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
      locationManager = lm
      try {
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
          lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000L, 0f, this, Looper.getMainLooper())
          lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { saveLocationToPrefs(it) }
        }
      } catch (_: Exception) {}
      try {
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
          lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000L, 0f, this, Looper.getMainLooper())
          if (latestLocation == null) {
            lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)?.let { saveLocationToPrefs(it) }
          }
        }
      } catch (_: Exception) {}
      try {
        if (latestLocation == null && lm.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
          lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)?.let { saveLocationToPrefs(it) }
        }
      } catch (_: Exception) {}
    } catch (_: Exception) {}
  }

  private fun stopNativeLocationUpdates() {
    try {
      locationManager?.removeUpdates(this)
    } catch (_: Exception) {}
  }

  override fun onLocationChanged(location: Location) {
    saveLocationToPrefs(location)
  }

  @Deprecated("Deprecated in Java")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
  override fun onProviderEnabled(provider: String) {}
  override fun onProviderDisabled(provider: String) {}

  private fun saveLocationToPrefs(loc: Location) {
    latestLocation = loc
    try {
      val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit()
        .putString(KEY_LAST_LAT, loc.latitude.toString())
        .putString(KEY_LAST_LNG, loc.longitude.toString())
        .putFloat(KEY_LAST_ACC, loc.accuracy)
        .putFloat(KEY_LAST_SPEED, loc.speed)
        .putFloat(KEY_LAST_HEADING, loc.bearing)
        .putString(KEY_LAST_ALT, loc.altitude.toString())
        .apply()
    } catch (_: Exception) {}
  }

  private fun startBackgroundTelemetryAndAlertsLoop() {
    try {
      scheduler?.shutdownNow()
    } catch (_: Exception) {}
    val exec = Executors.newSingleThreadScheduledExecutor()
    scheduler = exec
    exec.scheduleAtFixedRate({
      sendNativeTelemetryHeartbeat()
      pollTacticalNotificationsNative()
    }, 2L, 4L, TimeUnit.SECONDS)
  }

  @SuppressLint("MissingPermission")
  private fun resolveCurrentCoords(): Pair<Double, Double>? {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    var loc = latestLocation
    if (loc == null) {
      val lm = locationManager ?: (getSystemService(Context.LOCATION_SERVICE) as? LocationManager)
      loc = try { lm?.getLastKnownLocation(LocationManager.GPS_PROVIDER) } catch (_: Exception) { null }
        ?: try { lm?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) } catch (_: Exception) { null }
        ?: try { lm?.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER) } catch (_: Exception) { null }
      if (loc != null) {
        saveLocationToPrefs(loc)
      }
    }
    val lat = loc?.latitude ?: prefs.getString(KEY_LAST_LAT, null)?.toDoubleOrNull() ?: return null
    val lng = loc?.longitude ?: prefs.getString(KEY_LAST_LNG, null)?.toDoubleOrNull() ?: return null
    return Pair(lat, lng)
  }

  @SuppressLint("MissingPermission")
  private fun sendNativeTelemetryHeartbeat() {
    try {
      val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val active = prefs.getBoolean(KEY_SESSION_ACTIVE, false)
      val token = prefs.getString(KEY_TOKEN, null)
      val apiUrl = prefs.getString(
        KEY_API_URL,
        "https://sigo-api-243815551696.southamerica-west1.run.app/api/v1"
      )
      if (!active || token.isNullOrBlank() || apiUrl.isNullOrBlank()) return

      val coords = resolveCurrentCoords() ?: return
      val loc = latestLocation
      val acc = loc?.accuracy ?: prefs.getFloat(KEY_LAST_ACC, 8f)
      val spd = loc?.speed ?: prefs.getFloat(KEY_LAST_SPEED, 0f)
      val hdg = loc?.bearing ?: prefs.getFloat(KEY_LAST_HEADING, 0f)
      val alt = loc?.altitude ?: prefs.getString(KEY_LAST_ALT, "15.0")?.toDoubleOrNull() ?: 15.0

      val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
      }
      val isoNow = sdf.format(Date())

      val payload = JSONObject().apply {
        put("latitude", coords.first)
        put("longitude", coords.second)
        put("accuracy", acc.toDouble())
        put("speed", spd.toDouble())
        put("heading", hdg.toDouble())
        put("altitude", alt)
        put("timestamp_gps", isoNow)
      }

      val endpoint = "${apiUrl.trimEnd('/')}/patrol/telemetry"
      val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 7000
        readTimeout = 7000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }

      OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
        writer.write(payload.toString())
        writer.flush()
      }

      conn.responseCode
      conn.disconnect()
    } catch (_: Exception) {}
  }

  /**
   * Consulta en segundo plano misiones asignadas, mensajes del supervisor y estado SOS
   * para disparar notificaciones del sistema con sonido incluso cuando la app fue cerrada
   * (mientras el funcionario no haya cerrado sesión).
   */
  private fun pollTacticalNotificationsNative() {
    try {
      val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val active = prefs.getBoolean(KEY_SESSION_ACTIVE, false)
      val token = prefs.getString(KEY_TOKEN, null)
      val apiUrl = prefs.getString(
        KEY_API_URL,
        "https://sigo-api-243815551696.southamerica-west1.run.app/api/v1"
      )?.trimEnd('/')
      if (!active || token.isNullOrBlank() || apiUrl.isNullOrBlank()) return

      // 1. Verificar misión activa / nueva rotación y geocerca
      try {
        val missionJson = httpGetJson("$apiUrl/patrol/assignment", token)
        val asig = missionJson?.optJSONObject("asignacion")
        if (asig != null) {
          val idAsig = asig.optInt("id_asignacion", -1)
          val nombreZona = asig.optString("nombre_zona", "Sector asignado")
          val lastMissionId = prefs.getInt(KEY_LAST_MISSION_ID, -1)

          if (idAsig > 0 && idAsig != lastMissionId) {
            prefs.edit()
              .putInt(KEY_LAST_MISSION_ID, idAsig)
              .putBoolean("was_inside_zone_$idAsig", false)
              .apply()
            dispatchNativeAlert(
              "SIGO · Nueva Misión Asignada",
              "Desplazamiento hacia $nombreZona.",
              false
            )
          }

          // Evaluar ingreso o salida del perímetro si hay coordenadas
          val coords = resolveCurrentCoords()
          if (coords != null && !asig.isNull("centro_lat") && !asig.isNull("centro_lng")) {
            val cLat = asig.optDouble("centro_lat", 0.0)
            val cLng = asig.optDouble("centro_lng", 0.0)
            val radioM = maxOf(20.0, asig.optDouble("radio_m", 160.0))
            val distArr = FloatArray(1)
            Location.distanceBetween(coords.first, coords.second, cLat, cLng, distArr)
            val isInside = distArr[0] <= radioM
            val wasInside = prefs.getBoolean("was_inside_zone_$idAsig", false)

            if (isInside && !wasInside) {
              prefs.edit().putBoolean("was_inside_zone_$idAsig", true).apply()
              dispatchNativeAlert(
                "SIGO · Arribo a Zona",
                "Has arribado a $nombreZona. Patrullaje activo.",
                false
              )
            } else if (!isInside && wasInside) {
              prefs.edit().putBoolean("was_inside_zone_$idAsig", false).apply()
              dispatchNativeAlert(
                "SIGO · Fuera de Perímetro",
                "Has salido de la circunferencia asignada ($nombreZona), vuelve al perímetro de patrullaje.",
                true
              )
            }
          }
        }
      } catch (_: Exception) {}

      // 2. Verificar mensajes entrantes del supervisor
      try {
        val msgsJson = httpGetJson("$apiUrl/patrol/messages", token)
        val arr = msgsJson?.optJSONArray("mensajes")
        if (arr != null && arr.length() > 0) {
          val lastMsg = arr.getJSONObject(arr.length() - 1)
          val idMsg = lastMsg.optInt("id_mensaje", -1)
          val remitente = lastMsg.optString("remitente", "")
          val texto = lastMsg.optString("texto", "")
          val prevMsgId = prefs.getInt(KEY_LAST_MSG_ID, -1)

          if (prevMsgId == -1) {
            prefs.edit().putInt(KEY_LAST_MSG_ID, idMsg).apply()
          } else if (idMsg > prevMsgId) {
            prefs.edit().putInt(KEY_LAST_MSG_ID, idMsg).apply()
            if (remitente.equals("SUPERVISOR", ignoreCase = true)) {
              val cleanBody = if (texto.startsWith("[AUDIO]")) {
                "Nota de voz recibida de la Central"
              } else {
                texto
              }
              dispatchNativeAlert(
                "SIGO · Mensaje de la Central",
                cleanBody,
                false
              )
            }
          }
        }
      } catch (_: Exception) {}

      // 3. Verificar estado de emergencia SOS
      try {
        val sosJson = httpGetJson("$apiUrl/patrol/sos/estado", token)
        if (sosJson != null && sosJson.has("activa")) {
          val activa = sosJson.optBoolean("activa", false)
          val prevActiva = prefs.getBoolean(KEY_LAST_SOS_ACTIVA, false)
          if (prevActiva && !activa) {
            dispatchNativeAlert(
              "SIGO · Emergencia Resuelta",
              "Emergencia resuelta por el operador de la central.",
              false
            )
          }
          prefs.edit().putBoolean(KEY_LAST_SOS_ACTIVA, activa).apply()
        }
      } catch (_: Exception) {}
    } catch (_: Exception) {}
  }

  private fun httpGetJson(urlStr: String, token: String): JSONObject? {
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 6000
        readTimeout = 6000
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }
      if (conn.responseCode in 200..299) {
        val text = BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { it.readText() }
        JSONObject(text)
      } else {
        null
      }
    } catch (_: Exception) {
      null
    } finally {
      try { conn?.disconnect() } catch (_: Exception) {}
    }
  }

  private fun ensureAlertChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val pkg = packageName

      val chimeUri = Uri.parse("android.resource://$pkg/${R.raw.chime}")
      val chimeAttrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      val alertChannel = NotificationChannel(
        SigoBackgroundModule.CHANNEL_ALERTS,
        "Alertas Tácticas y Mensajes SIGO",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notificaciones de misiones asignadas y mensajes de la central"
        enableLights(true)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 250, 150, 250)
        setSound(chimeUri, chimeAttrs)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }

      val sosUri = Uri.parse("android.resource://$pkg/${R.raw.sos}")
      val sosAttrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      val sosChannel = NotificationChannel(
        SigoBackgroundModule.CHANNEL_SOS,
        "Emergencias SOS SIGO",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Alertas críticas de refuerzos y código rojo"
        enableLights(true)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
        setSound(sosUri, sosAttrs)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }

      manager.createNotificationChannel(alertChannel)
      manager.createNotificationChannel(sosChannel)
    }
  }

  private fun dispatchNativeAlert(title: String, body: String, isSos: Boolean) {
    try {
      val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val now = System.currentTimeMillis()
      val hash = "$title|$body"
      val lastHash = prefs.getString(KEY_LAST_NOTIF_HASH, "")
      val lastTime = prefs.getLong(KEY_LAST_NOTIF_TIME, 0L)
      if (hash == lastHash && (now - lastTime) < 6000L) {
        return
      }
      prefs.edit()
        .putString(KEY_LAST_NOTIF_HASH, hash)
        .putLong(KEY_LAST_NOTIF_TIME, now)
        .apply()

      ensureAlertChannels()
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val launchIntent = Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      val id = bgNotifIdCounter++
      val pendingIntent = PendingIntent.getActivity(this, id, launchIntent, pendingFlags)

      val channelId = if (isSos) SigoBackgroundModule.CHANNEL_SOS else SigoBackgroundModule.CHANNEL_ALERTS
      val soundUri = Uri.parse("android.resource://$packageName/${if (isSos) R.raw.sos else R.raw.chime}")

      val notification = NotificationCompat.Builder(this, channelId)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(if (isSos) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_MESSAGE)
        .setSound(soundUri)
        .setVibrate(if (isSos) longArrayOf(0, 500, 200, 500, 200, 500) else longArrayOf(0, 250, 150, 250))
        .build()

      manager.notify(id, notification)
    } catch (_: Exception) {}
  }

  private fun createServiceChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Servicio Activo SIGO",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Mantiene el monitoreo GPS y recepción de alertas en segundo plano"
        setShowBadge(false)
      }
      val manager = getSystemService(NotificationManager::class.java)
      manager?.createNotificationChannel(channel)
    }
  }

  private fun buildServiceNotification(): Notification {
    val launchIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags)

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("SIGO · Turno Operativo Activo")
      .setContentText("GPS y notificaciones activas 24/7 hasta cerrar sesión")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }
}
