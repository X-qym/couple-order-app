// ==============================================
// 👇 配置信息（已经是你的，不用改）
// ==============================================
const SUPABASE_URL = "https://htncscadulptxewedblf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_62M-HWaCglRofXcXtrATHQ_rXUQDo9f";
const BOY_UID = "1d43722b-15c0-48c0-aefb-49fbf2362921";
const GIRL_UID = "1d43722b-15c0-48c0-aefb-49fbf2362921";
// ==============================================

// ✅ 修复：变量名改成sb，避免和全局supabase重名
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全局变量
let currentUser = null;
let currentRole = null;
let cart = {};
let dishes = [];
let dishesSubscription = null;
let ordersSubscription = null;
let messagesSubscription = null;

// 应用入口函数
async function initApp() {
    // 检查用户登录状态
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        currentUser = user;
        currentRole = user.email === 'boy@couple.com' ? 'boy' : 'girl';
        showMainApp();
        await loadDishes();
        setupRealTimeListeners();
        await initNotifications();
    }
    
    // 监听登录状态变化
    sb.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            currentRole = session.user.email === 'boy@couple.com' ? 'boy' : 'girl';
            showMainApp();
            await loadDishes();
            setupRealTimeListeners();
            await initNotifications();
        } else {
            currentUser = null;
            currentRole = null;
            showWelcomeScreen();
        }
    });
    
    // 注册Service Worker（没有就注释掉，避免报错）
    // if ('serviceWorker' in navigator) {
    //     try {
    //         await navigator.serviceWorker.register('/sw.js');
    //         console.log('Service Worker注册成功');
    //     } catch (e) {
    //         console.log('Service Worker注册失败:', e);
    //     }
    // }
}

// 用户登录函数（和HTML里的onclick一致）
async function login(role) {
    try {
        const email = role === 'boy' ? 'boy@couple.com' : 'girl@couple.com';
        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: '123456'
        });
        
        if (error) throw error;
        
        // 保存用户角色到数据库
        await sb
            .from('users')
            .upsert({
                id: data.user.id,
                email: email,
                role: role
            });
            
    } catch (error) {
        alert('登录失败: ' + error.message);
    }
}

// 显示欢迎页面
function showWelcomeScreen() {
    document.getElementById('welcomeScreen').classList.add('active');
    document.getElementById('orderScreen').classList.remove('active');
    document.getElementById('chatScreen').classList.remove('active');
    document.getElementById('bottomNav').style.display = 'none';
}

// 显示主应用界面
function showMainApp() {
    document.getElementById('welcomeScreen').classList.remove('active');
    document.getElementById('orderScreen').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';
}

// 切换底部标签页
function switchTab(tab) {
    // 移除所有标签的激活状态
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    // 隐藏所有页面
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    
    if (tab === 'order') {
        document.getElementById('orderScreen').classList.add('active');
        document.getElementById('appBar').textContent = '点餐';
        document.querySelectorAll('.nav-item')[0].classList.add('active');
    } else if (tab === 'chat') {
        document.getElementById('chatScreen').classList.add('active');
        document.getElementById('appBar').textContent = '聊天';
        document.querySelectorAll('.nav-item')[1].classList.add('active');
        loadMessages();
    }
}

// 加载菜品数据
async function loadDishes() {
    const { data, error } = await sb
        .from('dishes')
        .select('*')
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('加载菜品失败:', error);
        return;
    }
    
    dishes = data;
    renderDishes();
}

// 渲染菜品列表
function renderDishes() {
    const grid = document.getElementById('dishesGrid');
    grid.innerHTML = '';
    
    dishes.forEach(dish => {
        const quantity = cart[dish.id] || 0;
        const card = document.createElement('div');
        card.className = 'dish-card';
        card.innerHTML = `
            <img src="${dish.image_url}" class="dish-img" alt="${dish.name}">
            <div class="dish-info">
                <div class="dish-name">${dish.name}</div>
                <div class="dish-price">¥${dish.price.toFixed(2)}</div>
                <div class="quantity-control">
                    <button class="quantity-btn" onclick="updateCart('${dish.id}', -1)">-</button>
                    <span>${quantity}</span>
                    <button class="quantity-btn" onclick="updateCart('${dish.id}', 1)">+</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 更新购物车
function updateCart(dishId, change) {
    if (!cart[dishId]) cart[dishId] = 0;
    cart[dishId] += change;
    
    // 数量不能小于0
    if (cart[dishId] < 0) cart[dishId] = 0;
    // 数量为0时从购物车移除
    if (cart[dishId] === 0) delete cart[dishId];
    
    updateCartBadge();
    renderDishes();
}

// 更新购物车角标
function updateCartBadge() {
    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    document.getElementById('cartBadge').textContent = totalItems;
}

// 切换购物车显示/隐藏
function toggleCart() {
    const modal = document.getElementById('cartModal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    renderCart();
}

// 渲染购物车内容
function renderCart() {
    const cartItemsDiv = document.getElementById('cartItems');
    cartItemsDiv.innerHTML = '';
    
    let total = 0;
    
    for (const [dishId, quantity] of Object.entries(cart)) {
        const dish = dishes.find(d => d.id === dishId);
        if (!dish) continue;
        
        const itemTotal = dish.price * quantity;
        total += itemTotal;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <div>
                <div style="font-weight: bold;">${dish.name}</div>
                <div style="color: #666;">¥${dish.price.toFixed(2)} x ${quantity}</div>
            </div>
            <div style="font-weight: bold;">¥${itemTotal.toFixed(2)}</div>
        `;
        cartItemsDiv.appendChild(itemDiv);
    }
    
    document.getElementById('cartTotal').textContent = `¥${total.toFixed(2)}`;
}

// 提交订单
async function submitOrder() {
    if (Object.keys(cart).length === 0) {
        alert('购物车为空');
        return;
    }
    
    try {
        const orderItems = [];
        let totalPrice = 0;
        
        // 构建订单数据
        for (const [dishId, quantity] of Object.entries(cart)) {
            const dish = dishes.find(d => d.id === dishId);
            if (!dish) continue;
            
            orderItems.push({
                name: dish.name,
                price: dish.price,
                quantity: quantity
            });
            totalPrice += dish.price * quantity;
        }
        
        // 将订单保存到数据库
        const { error } = await sb
            .from('orders')
            .insert({
                user_id: currentUser.id,
                user_name: currentRole === 'boy' ? '男朋友' : '女朋友',
                dishes: orderItems,
                total_price: totalPrice,
                remark: document.getElementById('remarkInput').value
            });
        
        if (error) throw error;
        
        // 清空购物车
        cart = {};
        updateCartBadge();
        document.getElementById('remarkInput').value = '';
        toggleCart();
        
        alert('订单提交成功！');
    } catch (error) {
        alert('提交失败: ' + error.message);
    }
}

// 加载聊天消息
function loadMessages() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    // 获取历史消息
    sb
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data, error }) => {
            if (error) {
                console.error('加载消息失败:', error);
                return;
            }
            
            // 反转顺序，最新的消息显示在底部
            data.reverse().forEach(msg => {
                renderMessage(msg);
            });
            
            // 自动滚动到底部
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
}

// 渲染单条消息
function renderMessage(msg) {
    const chatMessages = document.getElementById('chatMessages');
    const isSent = msg.sender_id === currentUser.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    // 格式化时间
    const time = new Date(msg.created_at).toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div>${msg.content}</div>
        <div class="message-time">${time}</div>
    `;
    chatMessages.appendChild(messageDiv);
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;
    
    try {
        // 确定接收者ID
        const receiverId = currentRole === 'boy' ? GIRL_UID : BOY_UID;
        
        // 将消息保存到数据库
        const { error } = await sb
            .from('messages')
            .insert({
                sender_id: currentUser.id,
                receiver_id: receiverId,
                content: content
            });
        
        if (error) throw error;
        
        input.value = '';
    } catch (error) {
        alert('发送失败: ' + error.message);
    }
}

// 设置实时监听器（新订单和新消息）
function setupRealTimeListeners() {
    // 监听新订单（只有男朋友能收到）
    if (currentRole === 'boy') {
        ordersSubscription = sb
            .channel('orders-channel')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'orders', filter: `user_id=eq.${GIRL_UID}` },
                (payload) => {
                    const order = payload.new;
                    showLocalNotification('宝贝点餐啦！', `订单金额：¥${order.total_price.toFixed(2)}\n备注：${order.remark || '无'}`);
                }
            )
            .subscribe();
    }
    
    // 监听新消息
    messagesSubscription = sb
        .channel('messages-channel')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` },
            async (payload) => {
                const msg = payload.new;
                const senderName = msg.sender_id === BOY_UID ? '男朋友' : '女朋友';
                showLocalNotification(`新消息来自${senderName}`, msg.content);
                
                // 标记消息为已读
                await sb
                    .from('messages')
                    .update({ is_read: true })
                    .eq('id', msg.id);
                
                // 如果在聊天页面，直接渲染消息
                if (document.getElementById('chatScreen').classList.contains('active')) {
                    renderMessage(msg);
                    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
                }
            }
        )
        .subscribe();
}

// 初始化通知系统
async function initNotifications() {
    try {
        // 请求用户通知权限
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('未开启通知权限，不影响核心功能');
            return;
        }
    } catch (error) {
        console.log('通知初始化失败:', error);
    }
}

// 显示本地通知
function showLocalNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'https://img.icons8.com/fluency/192/000000/food.png'
        });
    }
}

// 启动应用
initApp();
