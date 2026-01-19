public class CodeBlockDeprecatedTest {
  /**
   * Test method with deprecated annotation in code block.
   * @param input The input parameter
   * @deprecated This method is deprecated
   * @example
   * {@code
   * @deprecated
   * public void oldMethod() {}
   * }
   */
  public void methodWithDeprecatedInCode(String input) {}
  
  /**
   * Test with multiple deprecated annotations.
   * @deprecated This class is deprecated
   * @example
   * {@code
   * @deprecaTed
   * public class OldClass {}
   * }
   */
  public void multipleDeprecatedInCode() {}
  
  /**
   * Test with deprecated in nested code blocks.
   * @example
   * {@code
   * @deprecated
   * public void method1() {}
   * }
   * Some text between code blocks.
   * {@code
   * @deprecated
   * public void method2() {}
   * }
   */
  public void nestedCodeBlocks() {}
}

