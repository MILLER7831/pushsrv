// server.js - сервер для отправки push-уведомлений
const express = require('express');
const webPush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Настройка Supabase
const supabaseUrl = 'https://cyzzuypqgkrtjpgngyot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5enp1eXBxZ2tydGpwZ25neW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDg1OTIsImV4cCI6MjA5MTk4NDU5Mn0.zgrvmqXkq3DRwvMxXcGNYM1EP3SgRBPE7dbU3o4vkj0';
const supabase = createClient(supabaseUrl, supabaseKey);

// Ваши VAPID ключи
const vapidKeys = {
    publicKey: 'BPwveoFc7oNdBZbjSoTDXdNJxr64Qzn5DhVHXtWkVYKz_ZwmfZcVs0XUM19pE_b88NmRJmGmto7LyHgbXhQgm4g',
    privateKey: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgVN07Zb5vmj80F2xsLmdeMjjq8FfTCz9Zuk1GiVsq0SqhRANCAAT8L3qBXO6DXQWW40qEw13TSca-uEM5-Q4VR17VpFWCs_2cJn2XFbNF1DNfaRP2_PDZkSZhpraOy8h4G14UIJuI'
};

webPush.setVapidDetails(
    'mailto:wernerhans819@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Эндпоинт для отправки уведомления
app.post('/api/send-notification', async (req, res) => {
    const { userId, title, body, chatId, senderName } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    
    try {
        // Получаем push-подписку пользователя
        const { data: subscriptionData, error } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', userId)
            .single();
        
        if (error || !subscriptionData) {
            console.log('Нет подписки для пользователя:', userId);
            return res.json({ success: false, error: 'No subscription found' });
        }
        
        const subscription = JSON.parse(subscriptionData.subscription);
        
        const payload = JSON.stringify({
            title: title || 'TES Messenger',
            body: body || 'Новое сообщение',
            icon: 'https://your-domain.com/icon-192.png',
            badge: 'https://your-domain.com/badge-72.png',
            data: { chatId: chatId, url: '/' },
            vibrate: [200, 100, 200],
            tag: 'message_' + Date.now(),
            requireInteraction: true
        });
        
        await webPush.sendNotification(subscription, payload);
        console.log('Уведомление отправлено пользователю:', userId);
        res.json({ success: true });
        
    } catch (error) {
        console.error('Ошибка отправки:', error);
        
        // Если подписка устарела (410), удаляем её
        if (error.statusCode === 410) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', userId);
            console.log('Устаревшая подписка удалена');
        }
        
        res.json({ success: false, error: error.message });
    }
});

// Эндпоинт для сохранения подписки (альтернативный)
app.post('/api/save-subscription', async (req, res) => {
    const { userId, subscription } = req.body;
    
    if (!userId || !subscription) {
        return res.status(400).json({ error: 'userId and subscription are required' });
    }
    
    try {
        await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                subscription: JSON.stringify(subscription),
                updated_at: new Date().toISOString()
            });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка сохранения подписки:', error);
        res.status(500).json({ error: error.message });
    }
});

// Эндпоинт для проверки статуса
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Push-сервер запущен на порту ${PORT}`);
});