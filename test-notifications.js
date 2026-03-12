const API_BASE = 'http://localhost:4000/api';

// Login credentials
const login = async () => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'amit@urbanretail.com',
      password: '123456'
    })
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const data = await response.json();
  return data.token;
};

const createTestNotifications = async (token) => {
  const notifications = [
    { title: 'New Order Received', body: 'Order #1234 has been placed for ₹2,500', type: 'ORDER' },
    { title: 'Customer Message', body: 'John Doe is asking about product availability', type: 'MESSAGE' },
    { title: 'System Alert', body: 'Inventory running low for popular items', type: 'ALERT' },
    { title: 'Revenue Milestone', body: 'You have achieved 100 orders this month!', type: 'SYSTEM' },
    { title: 'New Lead', body: 'A potential customer from Mumbai is interested', type: 'MESSAGE' }
  ];

  for (const notification of notifications) {
    try {
      const response = await fetch(`${API_BASE}/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notification)
      });
      
      if (response.ok) {
        console.log(`✅ Created: ${notification.title}`);
      } else {
        console.log(`❌ Failed to create: ${notification.title}`);
      }
    } catch (error) {
      console.error(`Error creating ${notification.title}:`, error);
    }
    
    // Small delay between notifications
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};

const main = async () => {
  try {
    console.log('🔐 Logging in...');
    const token = await login();
    console.log('✅ Login successful!');
    
    console.log('🔔 Creating test notifications...');
    await createTestNotifications(token);
    console.log('✅ Test notifications created successfully!');
    
    console.log('🌐 You can now test the notifications in the dashboard at http://localhost:5173');
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

main();
