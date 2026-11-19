/**
 * Fixora AI Sample Test File: JavaScript
 * This file contains intentional bugs, security risks, and code quality issues
 * for demonstrating Fixora AI features.
 */

// Issue 1: Hardcoded AWS Credential (Security)
const AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE";

function authenticateUser(userId, token) {
  // Issue 2: Loose equality comparison (Bug/Quality)
  if (userId == null) {
    return fal;
  }

  // Issue 3: Swallowed exception (Bug)
  try {
    const rawData = JSON.parse(token);
    return rawData.isVal;
  } catch (err) {
    // Silently swallowed error
  }
}

// Issue 4: SQL Injection vulnerability (Security)
function getUserData(db, userSearchQuery) {
  const query =
    "SELECT * FROM users WHERE username = '" + userSearchQuery + "'";
  return db.execute(query);
}

// Issue 5: Missing await on Promise (Bug)
async function fetchUserMetrics(apiClient, id) {
  const response = apiClient.get(`/metrics/${id}`); // Missing await
  return response.data;
}

module.exports = {
  authenticateUser,
  getUserData,
  fetchUserMetrics,
};
