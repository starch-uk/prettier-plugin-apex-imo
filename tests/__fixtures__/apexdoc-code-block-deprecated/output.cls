public class CodeBlockDeprecatedTest {
  /**
   * Test method with deprecated annotation in code block.
   * @param input The input parameter
   * @deprecated This method is deprecated
   * @example
   * {@code
   * @Deprecated
   * public void oldMethod() {}
   * }
   */
  public void methodWithDeprecatedInCode(String input) {}

  /**
   * Test with multiple deprecated annotations.
   * @deprecated This class is deprecated
   * @example
   * {@code
   * @Deprecated
   * public class OldClass {}
   * }
   */
  public void multipleDeprecatedInCode() {}

  /**
   * Test with deprecated in nested code blocks.
   * @example
   * {@code
   * @Deprecated
   * public void method1() {}
   * }
   * Some text between code blocks.
   * {@code
   * @Deprecated
   * public void method2() {}
   * }
   */
  public void nestedCodeBlocks() {}
}
