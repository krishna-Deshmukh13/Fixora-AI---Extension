/**
 * ============================================================
 *               FIXORA AI ALL-IN-ONE DEMO FILE
 * ============================================================
 * Open this file in VS Code to test all features of Fixora AI.
 */

// ------------------------------------------------------------
// 1. HARDCODED CREDENTIALS (Tests Secret Scanner)
// ------------------------------------------------------------
const STRIPE_SECRET = 'sk_test_dummy_mock_key_for_testing_12345';
const AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';
const DATABASE_URL =
  'postgres://admin:SuperSecretPass123@prod-db.internal:5432/mydb';

// ------------------------------------------------------------
// 2. DETERMINISTIC OFFLINE BUGS (Tests Bug Detector)
// ------------------------------------------------------------
function checkUserRole(role) {
  // Bug: Accidental single "=" assignment in "if" condition instead of "==="
  if ((role = 'admin')) {
    console.log('Access granted!');
  }

  // Bug: Loose equality type coercion
  if (role == null) {
    return false;
  }

  // Bug: Empty catch block silently swallowing exceptions
  try {
    const raw = JSON.parse(role);
    return raw.valid;
  } catch (err) {
    // Silently swallowed error
  }
}

// Bug: Unawaited async network call
async function syncUserData(apiClient, userId) {
  const result = apiClient.fetchUserData(userId); // Missing 'await'
  return result;
}

// ------------------------------------------------------------
// 3. HIGH COMPLEXITY & HEALTH SCORE (Tests Complexity Analyzer)
// ------------------------------------------------------------
// This function has a Cyclomatic Complexity > 12. Fixora AI will flag it!
function processOrderDiscount(
  userType,
  amount,
  couponCode,
  isHoliday,
  loyaltyTier
) {
  let discount = 0;
  if (userType === 'vip') {
    if (amount > 1000) {
      if (loyaltyTier === 'platinum') {
        discount = 0.3;
      } else if (loyaltyTier === 'gold') {
        discount = 0.25;
      } else {
        discount = 0.2;
      }
    } else if (amount > 500) {
      discount = 0.15;
    } else {
      discount = 0.1;
    }
  } else if (userType === 'regular') {
    if (couponCode === 'SAVE20' && isHoliday) {
      discount = 0.2;
    } else if (couponCode === 'SAVE10' || amount > 200) {
      discount = 0.1;
    }
  } else {
    discount = 0;
  }
  return amount - amount * discount;
}

// ------------------------------------------------------------
// 4. DUPLICATE CODE DETECTION (Tests Duplicate Detector)
// ------------------------------------------------------------
function exportCustomerReportA(customer) {
  const token = localStorage.getItem('auth_token');
  const headers = { Authorization: 'Bearer ' + token };
  const endpoint = 'https://api.internal.com/v1/customer/export';
  console.log('Preparing report dispatch for:', customer.id);
  return { token, headers, endpoint };
}

function exportCustomerReportB(customer) {
  const token = localStorage.getItem('auth_token');
  const headers = { Authorization: 'Bearer ' + token };
  const endpoint = 'https://api.internal.com/v1/customer/export';

  module.exports = {
    checkUserRole,
    syncUserData,
    processOrderDiscount,
    exportCustomerReportA,
    exportCustomerReportB,
  };
}
