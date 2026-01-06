public class DocumentationExample {
  /**
   * Comprehensive example of a test class structure with parallel test
   * execution, helper classes, and multiple test scenarios. This example
   * demonstrates best practices for organizing test code including inner helper
   * classes for data preparation, static utility methods for common operations,
   * and well-structured test methods that validate different aspects of the
   * system under test.
   * @example This example shows a complete test class implementation with
   * parallel execution enabled, demonstrating how to structure test classes
   * with helper classes and methods for maximum code reusability and
   * maintainability. The test class includes comprehensive test coverage for
   * various scenarios including positive test cases, negative test cases, and
   * bulk data processing scenarios.
   * {@code
   * @IsTest(isParallel=true)
   * public class ComplexIntegrationTest {
   *   public class TestDataHelper {
   *     public static List<Account> createAccounts(Integer count) {
   *       return new List<Account>();
   *     }
   *
   *     public static List<Contact> createContactsForAccounts(
   *       List<Account> accounts
   *     ) {
   *       return new List<Contact>();
   *     }
   *   }
   *
   *   @TestSetup
   *   static void setupTestData() {
   *     // Setup code here
   *   }
   *
   *   private static Boolean validateAccount(Account acc) {
   *     return acc != null;
   *   }
   *
   *   @IsTest
   *   static void createAccountWithValidData() {
   *     Account testAccount =
   *       new Account(Name = 'Test Account', Industry = 'Technology');
   *     Boolean isValid = ComplexIntegrationTest.validateAccount(testAccount);
   *     System.assert(isValid, 'Account should be valid');
   *     List<Account> accounts =
   *       ComplexIntegrationTest.TestDataHelper.createAccounts(5);
   *     System.assertEquals(5, accounts.size(), 'Should create 5 accounts');
   *     List<String> singleLineList = new List<String>{ 'single' };
   *     List<String> multiLineList = new List<String>{
   *       'first',
   *       'second',
   *       'third',
   *       'fourth'
   *     };
   *     Set<Integer> singleLineSet = new Set<Integer>{ 42 };
   *     Set<String> multiLineSet = new Set<String>{
   *       'alpha',
   *       'beta',
   *       'gamma'
   *     };
   *     Map<String, String> singleLineMap = new Map<String, String>{
   *       'key' => 'value'
   *     };
   *     Map<String, Integer> multiLineMap = new Map<String, Integer>{
   *       'one' => 1,
   *       'two' => 2,
   *       'three' => 3
   *     };
   *   }
   *
   *   @IsTest
   *   static void createAccountWithInvalidData() {
   *     try {
   *       Account invalidAccount = new Account();
   *       Boolean isValid =
   *         ComplexIntegrationTest.validateAccount(invalidAccount);
   *       System.assert(!isValid, 'Account should be invalid');
   *       List<Account> emptyList = new List<Account>();
   *       Map<String, List<String>> nestedMap = new Map<String, List<String>>{
   *         'tags' => new List<String>{
   *           'test',
   *           'integration'
   *         }
   *       };
   *     } catch (Exception e) {
   *       System.assert(true, 'Expected exception for invalid account');
   *     }
   *   }
   *
   *   @IsTest
   *   static void processBulkAccounts() {
   *     List<Account> accounts =
   *       ComplexIntegrationTest.TestDataHelper.createAccounts(200);
   *     for (Account acc : accounts) {
   *       Boolean isValid = ComplexIntegrationTest.validateAccount(acc);
   *       System.assert(isValid, 'Each account should be valid');
   *     }
   *     System.assertEquals(
   *       200,
   *       accounts.size(),
   *       'Should process all 200 accounts'
   *     );
   *     List<List<String>> nestedLists = new List<List<String>>{
   *       new List<String>{
   *         'a',
   *         'b'
   *       },
   *       new List<String>{
   *         'c',
   *         'd',
   *         'e'
   *       }
   *     };
   *     Map<String, Map<String, String>> nestedMaps =
   *       new Map<String, Map<String, String>>{
   *         'config' => new Map<String, String>{
   *           'key1' => 'value1',
   *           'key2' => 'value2'
   *         }
   *       };
   *   }
   * }
   * }
   */
  public void exampleMethod() {
  }
}
