/**
 * Calculates the factorial of a non-negative integer using recursion.
 *
 * @param {number} n The non-negative integer for which to calculate the factorial.
 * @returns {number} The factorial of n.  Returns 1 if n is 0.
 * @throws {Error} If n is negative or not an integer.
 */
function factorialRecursive(n) {
  // Error handling: Check for invalid input
  if (!Number.isInteger(n)) {
    throw new Error("Input must be an integer.");
  }
  if (n < 0) {
    throw new Error("Input must be a non-negative integer.");
  }

  // Base case: factorial of 0 is 1
  if (n === 0) {
    return 1;
  }

  // Recursive step: n! = n * (n-1)!
  return n * factorialRecursive(n - 1);
}


/**
 *  A wrapper function to handle potential errors gracefully.  
 *  This is crucial for production environments.
 * @param {number} n The number to calculate the factorial of.
 * @returns {number | string} The factorial or an error message.
 */
function calculateFactorial(n){
    try{
        return factorialRecursive(n);
    } catch (error){
        console.error("Error calculating factorial:", error.message); //Log the error for debugging
        return "Error: " + error.message; //Return a user-friendly error message
    }
}


// Example usage with error handling:
console.log(calculateFactorial(5)); // Output: 120
console.log(calculateFactorial(0)); // Output: 1
console.log(calculateFactorial(-1)); // Output: Error: Input must be a non-negative integer.
console.log(calculateFactorial(3.14)); // Output: Error: Input must be an integer.

//For testing purposes (optional):  Add more robust testing with a testing framework like Jest.
//Example using a simple test:
const testCases = [
    {input: 5, expected: 120},
    {input: 0, expected: 1},
    {input: 1, expected: 1},
    {input: 3, expected: 6},
    {input: -2, expected: "Error: Input must be a non-negative integer."},
    {input: 2.5, expected: "Error: Input must be an integer."}
];

testCases.forEach(testCase => {
    const result = calculateFactorial(testCase.input);
    console.assert(result === testCase.expected, `Test failed for input ${testCase.input}: Expected ${testCase.expected}, got ${result}`);
});

module.exports = {factorialRecursive, calculateFactorial}; //for testing or use in other modules