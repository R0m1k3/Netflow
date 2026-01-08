# Netflow Deployment Guide

You are encountering a `denied` error because the Docker image does not exist yet on the GitHub Container Registry. You must build it first.

## Option A: Automatic Build via GitHub (Recommended)

This method lets you simply run `docker compose up` on your server without manually copying files.

1.  **Trigger the Build:**
    You must push your latest code changes to GitHub to trigger the automated build action I created.
    ```bash
    git add .
    git commit -m "Setup Netflow deployment"
    git push origin main
    ```

2.  **Wait for the Build:**
    Go to your GitHub Repository -> **Actions** tab.
    Wait for the **Docker** workflow to reach a green success status.

3.  **Authenticate (If Repository is Private):**
    If your `Netflow` repository is Private, Unraid cannot pull the image without a password.
    *   Go to GitHub -> Settings -> Developer Settings -> Personal access tokens (Classic).
    *   Generate a new token with `read:packages` scope.
    *   On your Unraid terminal:
        ```bash
        docker login ghcr.io -u R0m1k3 -p <YOUR_TOKEN>
        ```

4.  **Deploy:**
    Now `docker compose up -d` will work.

---

## Option B: Manual Local Build (If you prefer uploading files)

If you prefer to build the image directly on your Unraid server (using the `netflow-deployment.zip` method):

1.  **Edit `docker-compose.prod.yml`:**
    You must **uncomment** the build section I previously disabled.

    ```yaml
    services:
      netflow:
        build:              # <--- Uncomment this
          context: .        # <--- Uncomment this
          dockerfile: docker/Dockerfile  # <--- Uncomment this
        image: ghcr.io/r0m1k3/netflow:latest
    ```

2.  **Upload Files:**
    Run `.\tools\package_for_unraid.ps1` and upload the zip to your server.

3.  **Deploy:**
    Run `docker compose up -d --build`.
