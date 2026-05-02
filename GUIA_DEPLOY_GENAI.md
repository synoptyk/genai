# 🚀 Guía de Despliegue: GENAI (Google Cloud)

Esta guía explica cómo mantener sincronizada tu aplicación **GENAI** tanto en GitHub como en Google Cloud Run.

---

## 🛠️ Flujo de Trabajo (Sincronización Total)

Para actualizar tu aplicación local en la nube y en GitHub simultáneamente, ejecuta el siguiente comando desde la raíz del proyecto:

```bash
npm run deploy:full
```

Este comando realizará las siguientes acciones automáticamente:
1.  **Git Push:** Sube tus cambios locales a GitHub (`main`).
2.  **Google Cloud Deploy:** Ejecuta `./google-deploy.sh` para:
    *   Construir las nuevas imágenes de Docker (Backend y Frontend).
    *   Subirlas a Artifact Registry.
    *   Desplegar las nuevas versiones en **Cloud Run**.
    *   Inyectar automáticamente la URL del Backend en el Frontend.

---

## 📁 Estructura de Despliegue en GCP

El proyecto utiliza **Google Cloud Run** para una arquitectura escalable y segura:

- **Frontend:** `genai-client` (Puerto 8080)
- **Backend:** `genai-server` (Puerto 8080)
- **Región:** `us-central1`
- **Proyecto ID:** `genai360-494015`

---

## ⚙️ Variables de Entorno

Las variables de entorno se gestionan directamente en el script `google-deploy.sh`. Si necesitas cambiar la URI de MongoDB o las llaves de API, edita ese archivo antes de desplegar.

> [!IMPORTANT]
> No elimines el repositorio de GitHub. GitHub sirve como tu repositorio maestro de código y copia de seguridad, mientras que Google Cloud es donde vive la aplicación en ejecución.

---

## ✅ Comandos Útiles

- `npm run dev`: Inicia el entorno de desarrollo local.
- `npm run deploy:google`: Solo despliega en Google Cloud (sin subir a GitHub).
- `npm run deploy`: Solo sube cambios a GitHub (sin desplegar en Google Cloud).
- `npm run deploy:full`: Sincronización completa (Recomendado).
