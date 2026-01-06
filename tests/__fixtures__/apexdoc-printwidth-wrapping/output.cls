public class PrintWidthTest {
  /**
   * Test method with very long annotation descriptions that should wrap based
   * on printWidth.
   * @param input This is a very long parameter description that should
   * definitely wrap to the next line when the printWidth is set to a reasonable
   * value like 80 characters.
   * @return This is an extremely long return value description that contains
   * many words and should wrap properly when the printWidth setting is honored.
   * @throws IllegalArgumentException This is a very long exception description
   * that explains what happens when invalid input is provided to this method.
   * @see RelatedClass This is a long see annotation description that should
   * wrap.
   * @since 1.0.0 This is a long since annotation description.
   * @author John Developer This is a long author annotation description.
   * @version 2.0.0 This is a long version annotation description.
   * @deprecated This is a very long deprecated annotation description that
   * explains why this method is deprecated and what should be used instead.
   * @group Method This is a long group annotation description.
   * @example This is a long example annotation description that provides usage
   * information.
   */
  public void longAnnotations() {
  }

  /**
   * Test with shorter annotations that should not wrap.
   * @param input Input value
   * @return Result
   * @throws Exception If error
   */
  public void shortAnnotations() {
  }
}
