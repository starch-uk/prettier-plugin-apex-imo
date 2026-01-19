public class ComprehensiveTest {
  /**
   * Test with multiple annotations on same line.
   * @author John
   * @since 1.0
   * @version 2.0
   * @see RelatedClass
   */
  public void multipleOnSameLine() {}

  /**
   * Test with inconsistent spacing.
   * @param input The input with extra spaces
   * @return result The result with extra spaces
   * @throws Exception If something goes wrong
   */
  public String inconsistentSpacing(String input) {
    return input;
  }

  /**
   * Test with code blocks between annotations.
   * @author Developer
   * {@code String test = 'example'; }
   * @since 1.0
   * {@code Integer num = 42; }
   * @version 2.0
   * @see ExampleClass
   */
  public void codeBlocksBetweenAnnotations() {}

  /**
   * Comprehensive casing test for each annotation type.
   * @param input The input parameter
   * @return The return value
   * @throws ExceptionType The exception type
   * @see RelatedClass
   * @since 1.0.0
   * @author John Doe
   * @version 2.0.0
   * @deprecated This is deprecated
   * @group Class
   * @example
   * {@code Test t = new Test(); }
   */
  public void comprehensiveCasing() {}

  /**
   * Test with mixed case annotations.
   * @param input The input
   * @return The result
   * @throws Exception If error
   * @see Related
   * @since 1.0
   * @author Developer
   * @version 2.0
   * @deprecated Old method
   * @group Method
   * @example Example usage
   */
  public void mixedCase() {}

  /**
   * Test with annotations and code blocks mixed.
   * @author Dev
   * {@code
   * List<String> items = new List<String>{
   *   'a',
   *   'b'
   * };
   * }
   * @param input Input value
   * {@code Map<String, Integer> bob = new Map<String, Integer>{ 'key' => 1 }; }
   * @return result
   * @group Method
   */
  public String mixedAnnotationsAndCode(String input) {
    return input;
  }

  /**
   * Test with multiple group names in different cases.
   * @group Class
   * @group Interface
   * @group Enum
   * @group Method
   * @group Property
   * @group Variable
   */
  public void groupNameCasing() {}

  /**
   * Test with annotations at start of line without leading space.
   * @author Developer
   * @since 1.0
   * @version 2.0
   */
  public void noLeadingSpace() {}

  /**
   * Test with extra whitespace around annotations.
   * @author Developer
   * @since 1.0
   * @version 2.0
   */
  public void extraWhitespace() {}

  /**
   * Test with annotations followed by content on same line.
   * @param input Description here
   * @return result Description here
   * @throws Exception Description here
   * @see Class Description here
   * @since 1.0 Description here
   * @author Developer Description here
   * @version 2.0 Description here
   * @deprecated Description here
   * @group Method Description here
   * @example Description here
   */
  public void annotationsWithContent() {}
}
