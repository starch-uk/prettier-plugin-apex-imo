public class Test {
  /**
   * Manages customer account information and related operations.
   * This class bypasses user record access via 'without sharing' so that it 
   * can be used in a batch classes.
   * @Author John Developer
   * @Since 0.1.0
   * @Version 0.3.1
   * @See AccountProcessingBatch
   * @Group class
   * @Example
   * {@code
   * Account a;
   * try {
   *  a = new AccountManager().createAccount('Acme', 'Agriculture');
   * } catch (AccountManager.AccountException caught) {
   *   LOGGER.log(caught);
   *   // further exception handling
   * }
   * }
   */
  public void method() {}
  
  /**
   * Test method with various annotations.
   * @Param input The input string
   * @Return The processed result
   * @Throws IllegalArgumentException if input is invalid
   * @Group method
   */
  public String process(String input) {
    return input;
  }
  
  /**
   * Interface documentation.
   * @Group interface
   */
  public interface TestInterface {}
  
  /**
   * Enum documentation.
   * @Group enum
   */
  public enum TestEnum {}
  
  /**
   * Property documentation.
   * @Group property
   */
  public String testProperty { get; set; }
  
  /**
   * Variable documentation.
   * @Group variable
   */
  public String testVariable;
  
  /**
   * Unknown group name should not be changed.
   * @Group CustomGroup
   */
  public void customMethod() {}
}

