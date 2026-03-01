# 🚀 Guía de Despliegue Profesional: Gen AI

Esta guía replica el flujo de **Centraliza-T** para que puedas publicar Gen AI en internet y actualizarla desde tu Mac con un solo comando.

## 🛠 Servicios (Plan Gratuito)
- **GitHub**: Repositorio de código.
- **Render**: Servidor Backend (Node.js).
- **Vercel**: Interfaz Frontend (React).

---

## 1. Subir tu código a GitHub
Abre la terminal en `/Users/mauro/Synoptik_Innovacion/Gen AI` y ejecuta:

1. Crea un repositorio en GitHub llamado `gen-ai`. **No** agregues README.
2. Copia y pega los comandos que te da GitHub, parecidos a estos:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/gen-ai.git
   git branch -M main
   git push -u origin main
   ```

---

## 2. Configurar el Backend (Render)
1. Ve a [render.com](https://render.com) e inicia sesión con GitHub.
2. **New +** -> **Web Service**. Conecta tu repo `gen-ai`.
3. Configuración:
   - **Name**: `gen-ai-backend`
   - **Root Directory**: (Déjalo vacío)
   - **Build Command**: `npm install`
   - **Start Command**: `npm run server:prod`
   - **Instance Type**: **Free**
4. **Environment Variables** (Copia los valores de tu `.env` de Gen AI):
   - `MONGO_URI`: `mongodb+srv://...`
   - `JWT_SECRET`: `YYuFuf...` (El de Centraliza-T)
   - `SMTP_PASSWORD`: `Synoptyk.2026.##`
   - (Agrega todas las del `.env`)

---

## 3. Configurar el Frontend (Vercel)
1. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. **Add New...** -> **Project**. Importa `gen-ai`.
3. **Framework Preset**: "Create React App".
4. **Root Directory**: `client` (Muy importante).
5. Click en **Deploy**.

---

## 🔄 Cómo Actualizar (Flujo "Centraliza-T Style")
A partir de ahora, cuando hagas cambios en tu Mac, solo corre este comando:

```bash
npm run deploy
```

**¿Qué sucede?**
1. Git sube tus cambios a GitHub.
2. Vercel actualiza la web automáticamente (~1 min).
3. Render actualiza el servidor automáticamente (~2 min).

¡Todo sincronizado y profesional! 🚀
