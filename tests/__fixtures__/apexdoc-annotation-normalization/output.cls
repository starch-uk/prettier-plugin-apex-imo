public class Test {
  /**
   * Manages customer account information and related operations.
   * This class bypasses user record access via 'without sharing' so that it can
   * be used in a batch classes.
   * @author John Developer
   * @since 0.1.0
   * @version 0.3.1
   * @see AccountProcessingBatch
   * @group Class
   * @example
   * {@code
   * Account a;
   * try {
   *   a = new AccountManager().createAccount('Acme', 'Agriculture');
   * } catch (AccountManager.AccountException caught) {
   *   LOGGER.log(caught);
   *   // further exception handling
   * }
   * }
   */
  public void method() {}

  /**
   * Test method with various annotations.
   * @param input The input string
   * @return The processed result
   * @throws IllegalArgumentException if input is invalid
   * @group Method
   */
  public String process(String input) {
    return input;
  }

  /**
   * Interface documentation.
   * @group Interface
   */
  public interface TestInterface {}

  /**
   * Enum documentation.
   * @group Enum
   */
  public enum TestEnum {}

  /**
   * Property documentation.
   * @group Property
   */
  public String testProperty { get; set; }

  /**
   * Variable documentation.
   * @group Variable
   */
  public String testVariable;

  /**
   * Unknown group name should not be changed.
   * @group CustomGroup
   */
  public void customMethod() {}
}
