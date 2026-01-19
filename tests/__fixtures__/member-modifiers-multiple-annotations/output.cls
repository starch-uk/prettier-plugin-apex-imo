public class MultipleAnnotationsTest {
  @Deprecated
  @TestVisible
  public Integer field1;
  @TestVisible
  @Deprecated
  public Integer field2;
}
