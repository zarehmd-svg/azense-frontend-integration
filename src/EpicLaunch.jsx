import { useEffect } from "react";

export default function EpicLaunch() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const iss = params.get("iss");
    const launch = params.get("launch");

    if (!iss || !launch) {
      document.body.innerHTML = "<p>Missing iss or launch parameter.</p>";
      return;
    }

    const backend = "https://azense-backend.onrender.com/epic/launch-auth";
    const redirectUrl =
      `${backend}?iss=${encodeURIComponent(iss)}&launch=${encodeURIComponent(launch)}`;

    window.location.href = redirectUrl;
  }, []);

  return <div>Launching Cerner SMART app...</div>;
}
