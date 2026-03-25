import { useEffect, useState } from "react";

export default function cernerLaunch() {
  const [message, setMessage] = useState("Launching Cerner SMART app...");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const iss = params.get("iss");
      const launch = params.get("launch");

      if (!iss || !launch) {
        setMessage("Missing iss or launch parameter.");
        return;
      }

      try {
        const backend = "https://azense-backend.onrender.com/cerner/launch-auth";
        const res = await fetch(
          `${backend}?iss=${encodeURIComponent(iss)}&launch=${encodeURIComponent(
            launch
          )}`
        );

        const data = await res.json();

        if (!res.ok || !data.auth_url) {
          setMessage(
            data.detail || "Failed to get auth URL from backend."
          );
          return;
        }

        window.location.href = data.auth_url;
      } catch (err) {
        console.error(err);
        setMessage("Failed to contact backend for SMART launch.");
      }
    };

    run();
  }, []);

  return <div style={{ padding: 24 }}>{message}</div>;
}
