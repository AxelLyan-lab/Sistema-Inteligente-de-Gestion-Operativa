# ============================================================
# S.I.G.O. — Angular 18 Tactical Dashboard — Dockerfile
# ============================================================
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/dashboard-web/browser /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
