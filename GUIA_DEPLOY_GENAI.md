# 🚀 Guía de Despliegue Profesional: Genai

Esta guía te permitirá publicar **Genai** en internet usando tus cuentas existentes de GitHub, Render y Vercel, manteniendo el flujo automatizado de Centraliza-T.

---

## 1. Subir tu código a GitHub
Abre la terminal en tu Mac y ejecuta:

1. Crea un repositorio en GitHub llamado `Genai`. **No** agregues README.
2. Vincula tu carpeta local con GitHub:
   ```bash
   cd "/Users/mauro/Synoptik_Innovacion/Gen AI"
   git remote add origin https://github.com/TU_USUARIO/Genai.git
   git branch -M main
   git push -u origin main
   ```

---

## 2. Configurar el Backend (Render)
1. Ve a **Render** -> **New +** -> **Web Service**.
2. Conecta tu repositorio `Genai`.
3. Configura estos campos exactos:
   - **Name**: `genai-backend`
   - **Root Directory**: (Déjalo vacío / en blanco)
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. **Environment Variables** (Carga las de tu archivo `.env`):
   - `MONGO_URI`: `mongodb+srv://...` (La de Centraliza-T)
   - `JWT_SECRET`: `YYuFuf...`
   - `SMTP_PASSWORD`: `Synoptyk.2026.##`
   - `NODE_ENV`: `production`

---

## 3. Configurar el Frontend (Vercel)
1. Ve a **Vercel** -> **Add New...** -> **Project**.
2. Importa el repositorio `Genai`.
3. **Paso CRÍTICO**: En "Root Directory", haz clic en **Edit** y selecciona la carpeta **`client`**.
4. **Environment Variables**:
   - `REACT_APP_API_URL`: (La URL que te dio Render al final del paso anterior).
5. Haz clic en **Deploy**.

---

## 🔄 Cómo Actualizar (Flujo Centraliza-T)
Cada vez que quieras subir mejoras desde tu Mac, solo corre:

```bash
npm run deploy
```

¡Eso es todo! Tu plataforma **Genai** estará siempre actualizada y sincronizada. 🚀
