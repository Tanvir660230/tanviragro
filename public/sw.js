// Tanvir Agro ERP — Service Worker for Web Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Tanvir Agro", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "tanvir-agro",
    data: { url: data.url || "/dashboard" },
    requireInteraction: data.urgent === true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Tanvir Agro", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Required for PWA installability
self.addEventListener("fetch", (event) => {
  // Simple pass-through fetch to satisfy PWA requirements without aggressive caching.
  event.respondWith(fetch(event.request).catch(() => new Response("Offline")));
});
