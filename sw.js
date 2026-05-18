// Service Worker安装事件
self.addEventListener('install', (event) => {
  self.skipWaiting(); // 立即激活新的Service Worker
});

// Service Worker激活事件
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // 立即控制所有打开的页面
});

// 处理后台推送通知
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.notification.body,
    icon: 'https://img.icons8.com/fluency/192/000000/food.png',
    badge: 'https://img.icons8.com/fluency/96/000000/food.png'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.notification.title, options)
  );
});

// 处理通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/') // 点击通知打开应用
  );
});