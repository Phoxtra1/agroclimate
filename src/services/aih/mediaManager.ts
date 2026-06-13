import { MediaBackendConfig, StorageBackend } from "./types";
import { supabase } from "@/integrations/supabase/client";

const CONFIG_KEY = "aih_media_config";

const DEFAULT_CONFIG: MediaBackendConfig = {
  backend: "supabase",
  supabaseBucket: "drone-media",
};

export class MediaManager {
  static getConfig(): MediaBackendConfig {
    const data = localStorage.getItem(CONFIG_KEY);
    if (!data) return DEFAULT_CONFIG;
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  static saveConfig(config: MediaBackendConfig) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  /**
   * Resolves storage path inside folder structure:
   * /screenshots
   * /recordings
   * /flightlogs
   * /reports
   * /missions
   */
  private static getFolderAndExtension(
    type: "screenshot" | "recording" | "flightlog" | "report" | "mission"
  ): { folder: string; ext: string } {
    switch (type) {
      case "screenshot":
        return { folder: "screenshots", ext: "jpg" };
      case "recording":
        return { folder: "recordings", ext: "webm" };
      case "flightlog":
        return { folder: "flightlogs", ext: "json" };
      case "report":
        return { folder: "reports", ext: "json" };
      case "mission":
        return { folder: "missions", ext: "json" };
    }
  }

  static async storeMedia(
    file: Blob,
    type: "screenshot" | "recording" | "flightlog" | "report" | "mission",
    customName?: string,
    metadata: Record<string, any> = {}
  ): Promise<{ url: string; storagePath: string; backend: StorageBackend }> {
    const config = this.getConfig();
    const { folder, ext } = this.getFolderAndExtension(type);
    const filename = customName || `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const storagePath = `${folder}/${filename}`;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || "guest";

      switch (config.backend) {
        case "supabase": {
          if (!user) throw new Error("Authentication required for Supabase storage.");
          
          const fullPath = `${userId}/${storagePath}`;
          const bucket = config.supabaseBucket || "drone-media";

          // Upload file
          const { error: upErr } = await supabase.storage.from(bucket).upload(fullPath, file);
          if (upErr) throw upErr;

          // Save database reference
          const { data: dbData, error: dbErr } = await supabase
            .from("drone_media")
            .insert({
              user_id: user.id,
              media_type: type === "screenshot" ? "image" : type === "recording" ? "video" : "log",
              storage_path: fullPath,
              metadata: {
                ...metadata,
                aih_folder: folder,
                storage_backend: "supabase",
              },
            })
            .select("id")
            .maybeSingle();

          if (dbErr) console.warn("AIH Media: Could not log reference in DB:", dbErr);

          // Create public/signed url
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(fullPath, 60 * 60 * 24);
          
          return {
            url: signed?.signedUrl || "",
            storagePath: fullPath,
            backend: "supabase",
          };
        }

        case "s3": {
          // Simulate S3 client upload
          console.log(`[AIH S3 Upload] Uploading ${filename} to s3://${config.s3Bucket}/${folder}/`);
          await new Promise((r) => setTimeout(r, 600)); // Sim network latency
          
          const mockUrl = `https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com/${folder}/${filename}`;
          return {
            url: mockUrl,
            storagePath,
            backend: "s3",
          };
        }

        case "r2": {
          // Simulate Cloudflare R2 upload
          console.log(`[AIH R2 Upload] Uploading ${filename} to r2://${config.r2Bucket}/${folder}/`);
          await new Promise((r) => setTimeout(r, 500));
          
          const mockUrl = `https://${config.r2AccountId}.r2.cloudflarestorage.com/${config.r2Bucket}/${folder}/${filename}`;
          return {
            url: mockUrl,
            storagePath,
            backend: "r2",
          };
        }

        case "local":
        default: {
          // Local fallback: convert to base64, save in local storage database (simulated)
          console.log(`[AIH Local Storage] Saving ${filename} locally in browser database.`);
          
          const base64 = await new Promise<string>((res) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result as string);
            fr.readAsDataURL(file);
          });

          // Save local reference info
          const localMediaKey = "aih_local_media_store";
          const current = localStorage.getItem(localMediaKey) || "[]";
          const mediaArray = JSON.parse(current);
          mediaArray.unshift({
            id: crypto.randomUUID(),
            fileName: filename,
            folder,
            dataUrl: base64.slice(0, 10000), // truncate base64 for localstorage limits in demo
            capturedAt: new Date().toISOString(),
          });
          localStorage.setItem(localMediaKey, JSON.stringify(mediaArray.slice(0, 20))); // cap at 20

          return {
            url: base64,
            storagePath,
            backend: "local",
          };
        }
      }
    } catch (err: any) {
      console.error("AIH Media: Error writing to backend, using local fallback:", err);
      // Fallback
      return {
        url: URL.createObjectURL(file),
        storagePath,
        backend: "local",
      };
    }
  }
}
