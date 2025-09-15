Certainly! Below is a Node.js function that calculates the factorial of a number using recursion. The function includes proper error handling and is documented with JSDoc comments.

/**
 * Calculates the factorial of a non-negative integer using recursion.
 *
 * @param {number} n - The non-negative integer for which to calculate the factorial.
 * @returns {number} The factorial of the given number.
 * @throws {Error} Throws an error if the input is not a non-negative integer.
 *
 * @example
 * 
 * const result = factorial(5);
 * console.log(result); // Output: 120
 */
function factorial(n) {
    // Validate input
    if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
        throw new Error('Input must be a non-negative integer.');
    }

    // Base case: factorial of 0 is 1
    if (n === 0) {
        return 1;
    }

    // Recursive case
    return n * factorial(n - 1);
}

// Example usage
try {
    const result = factorial(5);
    console.log(`Factorial: ${result}`); // Output: Factorial: 120
} catch (error) {
    console.error(error.message);
}

### Explanation:
1. **Function Definition**: The `factorial` function takes a single parameter `n`, which is expected to be a non-negative integer.
2. **Input Validation**: Before proceeding with the calculation, the function checks if `n` is a number, non-negative, and an integer. If any of these conditions fail, it throws an error with a descriptive message.
3. **Base Case**: The base case for the recursion is defined as `factorial(0)`, which returns `1`.
4. **Recursive Case**: The function calls itself with `n - 1` until it reaches the base case.
5. **Error Handling**: The example usage includes a `try-catch` block to handle any potential errors gracefully.

This code is clean, well-documented, and ready for production use.