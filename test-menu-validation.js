// Test script to verify menu validation works correctly
const { orderParserService } = require('./startup/leadsync-backend/dist/services/orderParser.service');

// Mock menu with food items (no bike)
const mockMenu = {
  categories: [
    {
      name: "Food",
      items: [
        { name: "Burger", price: 150 },
        { name: "Pizza", price: 200 },
        { name: "Dosa", price: 80 }
      ]
    }
  ]
};

async function testMenuValidation() {
  console.log("=== Testing Menu Validation ===\n");
  
  // Test 1: Valid item (Burger)
  console.log("Test 1: Valid item 'Burger'");
  await orderParserService.processPotentialOrder(
    "company1",
    "conv1", 
    "lead1",
    "I want to order 1 burger",
    mockMenu
  );
  
  // Test 2: Invalid item (Bike) - should be rejected
  console.log("\nTest 2: Invalid item 'Bike' (should be rejected)");
  await orderParserService.processPotentialOrder(
    "company1",
    "conv2",
    "lead2", 
    "I want to order 1 bike",
    mockMenu
  );
  
  // Test 3: Mixed valid and invalid items
  console.log("\nTest 3: Mixed items '1 burger and 1 bike' (burger should be accepted, bike rejected)");
  await orderParserService.processPotentialOrder(
    "company1",
    "conv3",
    "lead3",
    "I want to order 1 burger and 1 bike",
    mockMenu
  );
  
  console.log("\n=== Test completed ===");
}

// Run the test
testMenuValidation().catch(console.error);
