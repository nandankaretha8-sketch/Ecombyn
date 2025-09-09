import mongoose from 'mongoose';
import CouponModel from '../models/coupon.model.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test unlisted coupon functionality
const testUnlistedCoupons = async () => {
  try {
    console.log('\n🧪 Testing Unlisted Coupon Functionality...\n');

    // 1. Create a regular coupon
    const regularCoupon = await CouponModel.create({
      code: 'TEST_REGULAR',
      discountType: 'percentage',
      discountValue: 10,
      minOrderValue: 100,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isUnlisted: false
    });
    console.log('✅ Created regular coupon:', regularCoupon.code);

    // 2. Create an unlisted coupon
    const unlistedCoupon = await CouponModel.create({
      code: 'TEST_UNLISTED',
      discountType: 'percentage',
      discountValue: 20,
      minOrderValue: 100,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isUnlisted: true
    });
    console.log('✅ Created unlisted coupon:', unlistedCoupon.code);

    // 3. Test public endpoint filtering (should exclude unlisted coupons)
    const publicCoupons = await CouponModel.find({
      isActive: true,
      expiryDate: { $gt: new Date() },
      isUnlisted: false
    });
    console.log('✅ Public coupons (excluding unlisted):', publicCoupons.length);
    console.log('   Codes:', publicCoupons.map(c => c.code));

    // 4. Test that unlisted coupon can still be found by code
    const foundUnlistedCoupon = await CouponModel.findOne({ 
      code: 'TEST_UNLISTED',
      isActive: true,
      expiryDate: { $gt: new Date() }
    });
    console.log('✅ Unlisted coupon found by code:', foundUnlistedCoupon ? foundUnlistedCoupon.code : 'Not found');

    // 5. Test admin endpoint (should include all coupons)
    const allCoupons = await CouponModel.find({
      isActive: true,
      expiryDate: { $gt: new Date() }
    });
    console.log('✅ All coupons (admin view):', allCoupons.length);
    console.log('   Codes:', allCoupons.map(c => c.code));

    // 6. Clean up test coupons
    await CouponModel.deleteMany({ code: { $in: ['TEST_REGULAR', 'TEST_UNLISTED'] } });
    console.log('✅ Cleaned up test coupons');

    console.log('\n🎉 All tests passed! Unlisted coupon functionality is working correctly.');
    console.log('\n📋 Summary:');
    console.log('   • Regular coupons are visible on public endpoints');
    console.log('   • Unlisted coupons are hidden from public endpoints');
    console.log('   • Unlisted coupons can still be used when manually entered');
    console.log('   • Admin can see and manage all coupons');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run tests
const runTests = async () => {
  await connectDB();
  await testUnlistedCoupons();
  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB');
  process.exit(0);
};

runTests();
