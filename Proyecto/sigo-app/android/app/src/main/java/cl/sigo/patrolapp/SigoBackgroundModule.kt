package cl.sigo.patrolapp

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class SigoBackgroundModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    const val CHANNEL_ALERTS = "sigo_tactical_alerts_v2"
    const val CHANNEL_SOS = "sigo_sos_alerts_v2"
    const val REQ_CAPTURE_PHOTO = 41001
    const val REQ_CAPTURE_VIDEO = 41002
    const val REQ_PICK_MEDIA = 41003
  }

  private var notifCounter = 2000
  private var pendingMediaPromise: Promise? = null
  private var pendingOutputFile: File? = null
  private var pendingIsVideo: Boolean = false

  // Native audio recorder & player state
  private var mediaRecorder: MediaRecorder? = null
  private var recordingFile: File? = null
  private var recordingStartMs: Long = 0L
  private var mediaPlayer: MediaPlayer? = null

  init {
    reactContext.addActivityEventListener(this)
    ensureChannels()
  }

  override fun getName(): String = "SigoBackground"

  private fun ensureChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val pkg = reactContext.packageName

      val chimeUri = Uri.parse("android.resource://$pkg/${R.raw.chime}")
      val chimeAttrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      val alertChannel = NotificationChannel(
        CHANNEL_ALERTS,
        "Alertas Tácticas y Mensajes SIGO",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notificaciones de misiones asignadas y mensajes de la central"
        enableLights(true)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 250, 150, 250)
        setSound(chimeUri, chimeAttrs)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      }

      val sosUri = Uri.parse("android.resource://$pkg/${R.raw.sos}")
      val sosAttrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      val sosChannel = NotificationChannel(
        CHANNEL_SOS,
        "Emergencias SOS SIGO",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Alertas críticas de refuerzos y código rojo"
        enableLights(true)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
        setSound(sosUri, sosAttrs)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      }

      manager.createNotificationChannel(alertChannel)
      manager.createNotificationChannel(sosChannel)
    }
  }

  @ReactMethod
  fun startBackgroundService(apiUrl: String?, token: String?) {
    try {
      val prefs = reactContext.getSharedPreferences(SigoBackgroundService.PREFS_NAME, Context.MODE_PRIVATE)
      val editor = prefs.edit().putBoolean(SigoBackgroundService.KEY_SESSION_ACTIVE, true)
      if (!apiUrl.isNullOrBlank()) {
        editor.putString(SigoBackgroundService.KEY_API_URL, apiUrl)
      }
      if (!token.isNullOrBlank()) {
        editor.putString(SigoBackgroundService.KEY_TOKEN, token)
      }
      editor.apply()

      val intent = Intent(reactContext, SigoBackgroundService::class.java)
      ContextCompat.startForegroundService(reactContext, intent)
    } catch (_: Exception) {}
  }

  @ReactMethod
  fun updateBackgroundLocation(lat: Double, lng: Double) {
    try {
      val prefs = reactContext.getSharedPreferences(SigoBackgroundService.PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit()
        .putString(SigoBackgroundService.KEY_LAST_LAT, lat.toString())
        .putString(SigoBackgroundService.KEY_LAST_LNG, lng.toString())
        .apply()
    } catch (_: Exception) {}
  }

  @ReactMethod
  fun stopBackgroundService() {
    try {
      val prefs = reactContext.getSharedPreferences(SigoBackgroundService.PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit()
        .putBoolean(SigoBackgroundService.KEY_SESSION_ACTIVE, false)
        .remove(SigoBackgroundService.KEY_TOKEN)
        .remove(SigoBackgroundService.KEY_LAST_MISSION_ID)
        .remove(SigoBackgroundService.KEY_LAST_MSG_ID)
        .remove(SigoBackgroundService.KEY_LAST_SOS_ACTIVA)
        .apply()

      val intent = Intent(reactContext, SigoBackgroundService::class.java)
      reactContext.stopService(intent)
    } catch (_: Exception) {}
  }

  @ReactMethod
  fun showSystemNotification(title: String, body: String, type: String) {
    try {
      val prefs = reactContext.getSharedPreferences(SigoBackgroundService.PREFS_NAME, Context.MODE_PRIVATE)
      val now = System.currentTimeMillis()
      val hash = "$title|$body"
      val lastHash = prefs.getString(SigoBackgroundService.KEY_LAST_NOTIF_HASH, "")
      val lastTime = prefs.getLong(SigoBackgroundService.KEY_LAST_NOTIF_TIME, 0L)
      if (hash == lastHash && (now - lastTime) < 6000L) {
        return
      }
      prefs.edit()
        .putString(SigoBackgroundService.KEY_LAST_NOTIF_HASH, hash)
        .putLong(SigoBackgroundService.KEY_LAST_NOTIF_TIME, now)
        .apply()

      ensureChannels()
      val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val launchIntent = Intent(reactContext, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val pendingIntent = PendingIntent.getActivity(reactContext, notifCounter, launchIntent, pendingFlags)

      val isSos = type.uppercase().contains("SOS") || type.uppercase().contains("FUERA")
      val channelId = if (isSos) CHANNEL_SOS else CHANNEL_ALERTS
      val pkg = reactContext.packageName
      val soundUri = Uri.parse("android.resource://$pkg/${if (isSos) R.raw.sos else R.raw.chime}")

      val notification = NotificationCompat.Builder(reactContext, channelId)
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

      manager.notify(notifCounter++, notification)
    } catch (_: Exception) {}
  }

  // ── Captura Nativa de Foto, Video y Galería ───────────────────────────────
  @ReactMethod
  fun capturePhotoNative(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No se encontró la actividad principal.")
      return
    }
    try {
      val dir = File(reactContext.cacheDir, "sigo_media").apply { mkdirs() }
      val file = File(dir, "foto_${System.currentTimeMillis()}.jpg")
      val uri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.sigofileprovider",
        file
      )

      pendingMediaPromise = promise
      pendingOutputFile = file
      pendingIsVideo = false

      val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
        putExtra(MediaStore.EXTRA_OUTPUT, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      }
      activity.startActivityForResult(intent, REQ_CAPTURE_PHOTO)
    } catch (e: Exception) {
      pendingMediaPromise = null
      pendingOutputFile = null
      promise.reject("CAMERA_ERROR", e.localizedMessage ?: "No se pudo abrir la cámara.")
    }
  }

  @ReactMethod
  fun captureVideoNative(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No se encontró la actividad principal.")
      return
    }
    try {
      val dir = File(reactContext.cacheDir, "sigo_media").apply { mkdirs() }
      val file = File(dir, "video_${System.currentTimeMillis()}.mp4")
      val uri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.sigofileprovider",
        file
      )

      pendingMediaPromise = promise
      pendingOutputFile = file
      pendingIsVideo = true

      val intent = Intent(MediaStore.ACTION_VIDEO_CAPTURE).apply {
        putExtra(MediaStore.EXTRA_OUTPUT, uri)
        putExtra(MediaStore.EXTRA_DURATION_LIMIT, 30)
        putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 0)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      }
      activity.startActivityForResult(intent, REQ_CAPTURE_VIDEO)
    } catch (e: Exception) {
      pendingMediaPromise = null
      pendingOutputFile = null
      promise.reject("VIDEO_ERROR", e.localizedMessage ?: "No se pudo abrir la cámara de video.")
    }
  }

  @ReactMethod
  fun pickMediaNative(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No se encontró la actividad principal.")
      return
    }
    try {
      pendingMediaPromise = promise
      pendingOutputFile = null
      pendingIsVideo = false

      val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
        addCategory(Intent.CATEGORY_OPENABLE)
      }
      activity.startActivityForResult(Intent.createChooser(intent, "Seleccionar evidencia"), REQ_PICK_MEDIA)
    } catch (e: Exception) {
      pendingMediaPromise = null
      promise.reject("PICKER_ERROR", e.localizedMessage ?: "No se pudo abrir la galería.")
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQ_CAPTURE_PHOTO && requestCode != REQ_CAPTURE_VIDEO && requestCode != REQ_PICK_MEDIA) {
      return
    }
    val promise = pendingMediaPromise ?: return
    val outFile = pendingOutputFile
    val isVid = pendingIsVideo

    pendingMediaPromise = null
    pendingOutputFile = null

    if (resultCode != Activity.RESULT_OK) {
      try { outFile?.delete() } catch (_: Exception) {}
      promise.resolve(null)
      return
    }

    try {
      if (requestCode == REQ_CAPTURE_PHOTO || requestCode == REQ_CAPTURE_VIDEO) {
        val finalFile = if (outFile != null && outFile.exists() && outFile.length() > 0L) {
          outFile
        } else if (data?.data != null) {
          copyContentUriToCache(data.data!!, if (isVid) ".mp4" else ".jpg")
        } else {
          null
        }

        if (finalFile == null || !finalFile.exists()) {
          promise.resolve(null)
          return
        }

        val map = Arguments.createMap().apply {
          putString("uri", Uri.fromFile(finalFile).toString())
          putString("fileName", finalFile.name)
          putString("type", if (isVid) "video" else "image")
          putString("mimeType", if (isVid) "video/mp4" else "image/jpeg")
          putDouble("fileSize", finalFile.length().toDouble())
          if (isVid) {
            putDouble("duration", getVideoDurationMs(finalFile).toDouble())
          }
        }
        promise.resolve(map)
      } else if (requestCode == REQ_PICK_MEDIA) {
        val contentUri = data?.data
        if (contentUri == null) {
          promise.resolve(null)
          return
        }
        val mime = reactContext.contentResolver.getType(contentUri) ?: "image/jpeg"
        val isVideoPicked = mime.startsWith("video/")
        val ext = if (isVideoPicked) ".mp4" else ".jpg"
        val copied = copyContentUriToCache(contentUri, ext)

        val map = Arguments.createMap().apply {
          putString("uri", Uri.fromFile(copied).toString())
          putString("fileName", copied.name)
          putString("type", if (isVideoPicked) "video" else "image")
          putString("mimeType", if (isVideoPicked) "video/mp4" else "image/jpeg")
          putDouble("fileSize", copied.length().toDouble())
          if (isVideoPicked) {
            putDouble("duration", getVideoDurationMs(copied).toDouble())
          }
        }
        promise.resolve(map)
      }
    } catch (e: Exception) {
      promise.reject("MEDIA_RESULT_ERROR", e.localizedMessage ?: "Error al procesar el archivo.")
    }
  }

  override fun onNewIntent(intent: Intent) {}

  private fun copyContentUriToCache(uri: Uri, defaultExt: String): File {
    val dir = File(reactContext.cacheDir, "sigo_media").apply { mkdirs() }
    var displayName: String? = null
    try {
      reactContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (idx >= 0) displayName = cursor.getString(idx)
        }
      }
    } catch (_: Exception) {}

    val safeName = (displayName?.replace(Regex("[^a-zA-Z0-9._-]"), "_") ?: "evidencia_${System.currentTimeMillis()}$defaultExt").let {
      if (it.contains('.')) it else "$it$defaultExt"
    }
    val dest = File(dir, "${System.currentTimeMillis()}_$safeName")
    reactContext.contentResolver.openInputStream(uri)?.use { input ->
      FileOutputStream(dest).use { output ->
        input.copyTo(output)
      }
    }
    return dest
  }

  private fun getVideoDurationMs(file: File): Long {
    return try {
      val retriever = MediaMetadataRetriever()
      retriever.setDataSource(file.absolutePath)
      val durStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
      retriever.release()
      durStr?.toLongOrNull() ?: 0L
    } catch (_: Exception) {
      0L
    }
  }

  // ── Grabación y Reproducción Nativa de Notas de Voz (MediaRecorder) ────────
  @ReactMethod
  fun startAudioRecordingNative(promise: Promise) {
    try {
      stopAudioRecorderInternal()
      val dir = File(reactContext.cacheDir, "sigo_audio").apply { mkdirs() }
      val outFile = File(dir, "nota_voz_${System.currentTimeMillis()}.m4a")

      val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        MediaRecorder(reactContext)
      } else {
        @Suppress("DEPRECATION")
        MediaRecorder()
      }

      recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
      recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
      recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      recorder.setAudioSamplingRate(44100)
      recorder.setAudioEncodingBitRate(96000)
      recorder.setOutputFile(outFile.absolutePath)
      recorder.prepare()
      recorder.start()

      mediaRecorder = recorder
      recordingFile = outFile
      recordingStartMs = System.currentTimeMillis()
      promise.resolve(Uri.fromFile(outFile).toString())
    } catch (e: Exception) {
      stopAudioRecorderInternal()
      promise.reject("AUDIO_REC_START_ERR", e.localizedMessage ?: "No se pudo iniciar la grabación de audio.")
    }
  }

  @ReactMethod
  fun stopAudioRecordingNative(promise: Promise) {
    val recorder = mediaRecorder
    val outFile = recordingFile
    val durationMs = System.currentTimeMillis() - recordingStartMs

    mediaRecorder = null
    recordingFile = null
    recordingStartMs = 0L

    if (recorder == null || outFile == null) {
      promise.resolve(null)
      return
    }

    try {
      recorder.stop()
    } catch (_: Exception) {
    } finally {
      try { recorder.release() } catch (_: Exception) {}
    }

    if (!outFile.exists() || outFile.length() == 0L) {
      promise.resolve(null)
      return
    }

    val map = Arguments.createMap().apply {
      putString("uri", Uri.fromFile(outFile).toString())
      putDouble("durationMillis", durationMs.toDouble())
      putDouble("fileSize", outFile.length().toDouble())
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun cancelAudioRecordingNative(promise: Promise) {
    val outFile = recordingFile
    stopAudioRecorderInternal()
    try { outFile?.delete() } catch (_: Exception) {}
    promise.resolve(true)
  }

  private fun stopAudioRecorderInternal() {
    val recorder = mediaRecorder
    mediaRecorder = null
    recordingFile = null
    recordingStartMs = 0L
    if (recorder != null) {
      try { recorder.stop() } catch (_: Exception) {}
      try { recorder.release() } catch (_: Exception) {}
    }
  }

  @ReactMethod
  fun playAudioUrlNative(url: String, promise: Promise) {
    try {
      stopAudioPlayerInternal()
      val player = MediaPlayer()
      player.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      player.setDataSource(url)
      player.setOnCompletionListener {
        stopAudioPlayerInternal()
      }
      player.setOnErrorListener { _, _, _ ->
        stopAudioPlayerInternal()
        true
      }
      player.prepareAsync()
      player.setOnPreparedListener { mp ->
        mp.start()
      }
      mediaPlayer = player
      promise.resolve(true)
    } catch (e: Exception) {
      stopAudioPlayerInternal()
      promise.reject("AUDIO_PLAY_ERR", e.localizedMessage ?: "No se pudo reproducir el audio.")
    }
  }

  @ReactMethod
  fun stopAudioPlayerNative(promise: Promise) {
    stopAudioPlayerInternal()
    promise.resolve(true)
  }

  private fun stopAudioPlayerInternal() {
    val player = mediaPlayer
    mediaPlayer = null
    if (player != null) {
      try { if (player.isPlaying) player.stop() } catch (_: Exception) {}
      try { player.release() } catch (_: Exception) {}
    }
  }
}
