public class ComprehensiveTest {
  /**
   * Test with multiple annotations on same line.
   * @Author John @Since 1.0 @Version 2.0
   * @See RelatedClass
   */
  public void multipleOnSameLine() {}
  
  /**
   * Test with inconsistent spacing.
   * @Param  input   The input with extra spaces
   * @Return   result   The result with extra spaces
   * @Throws   Exception   If something goes wrong
   */
  public String inconsistentSpacing(String input) {
    return input;
  }
  
  /**
   * Test with {@code} blocks between annotations.
   * @Author Developer
   * {@code
   * String test = 'example';
   * }
   * @Since 1.0
   * {@code
   * Integer num = 42;
   * }
   * @Version 2.0
   * @See ExampleClass
   */
  public void codeBlocksBetweenAnnotations() {}
  
  /**
   * Comprehensive casing test for each annotation type.
   * @PARAM input The input parameter
   * @RETURN The return value
   * @THROWS ExceptionType The exception type
   * @SEE RelatedClass
   * @SINCE 1.0.0
   * @AUTHOR John Doe
   * @VERSION 2.0.0
   * @DEPRECATED This is deprecated
   * @GROUP class
   * @EXAMPLE
   * {@code
   * Test t = new Test();
   * }
   */
  public void comprehensiveCasing() {}
  
  /**
   * Test with mixed case annotations.
   * @PaRaM input The input
   * @ReTuRn The result
   * @ThRoWs Exception If error
   * @SeE Related
   * @SiNcE 1.0
   * @AuThOr Developer
   * @VeRsIoN 2.0
   * @DePrEcAtEd Old method
   * @GrOuP method
   * @ExAmPlE Example usage
   */
  public void mixedCase() {}
  
  /**
   * Test with annotations and code blocks mixed.
   * @Author Dev
   * {@code
   * List<String> items = new List<String>{'a','b'};
   * }
   * @Param input Input value
   * {@code
   * Map<String, Integer> bob = new Map<String, Integer>{'key' => 1};
   * }
   * @Return result
   * @Group method
   */
  public String mixedAnnotationsAndCode(String input) {
    return input;
  }
  
  /**
   * Test with multiple group names in different cases.
   * @Group CLASS
   * @Group Interface
   * @Group ENUM
   * @Group Method
   * @Group PROPERTY
   * @Group Variable
   */
  public void groupNameCasing() {}
  
  /**
   * Test with annotations at start of line without leading space.
   *@Author Developer
   *@Since 1.0
   *@Version 2.0
   */
  public void noLeadingSpace() {}
  
  /**
   * Test with extra whitespace around annotations.
   *   @Author   Developer   
   *   @Since    1.0   
   *   @Version  2.0   
   */
  public void extraWhitespace() {}
  
  /**
   * Test with annotations followed by content on same line.
   * @Param input Description here
   * @Return result Description here
   * @Throws Exception Description here
   * @See Class Description here
   * @Since 1.0 Description here
   * @Author Developer Description here
   * @Version 2.0 Description here
   * @Deprecated Description here
   * @Group method Description here
   * @Example Description here
   */
  public void annotationsWithContent() {}
}

