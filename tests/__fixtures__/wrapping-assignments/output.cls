public class WrappingTests {
  public static final LongishTypeNameForWrap singleInstance =
    new LongishTypeNameForWrap();
  public static final LongishTypeNameForWrap singleInstanceWithOne =
    new LongishTypeNameForWrap('one');
  public static final LongishTypeNameForWrap singleInstanceWithTwo =
    new LongishTypeNameForWrap('one', 'two');

  public static final Set<LongishTypeNameForWrap> staticSet =
    new Set<LongishTypeNameForWrap>();
  public static final List<LongishTypeNameForWrap> staticList =
    new List<LongishTypeNameForWrap>();
  public static final Map<KeyTypeNameForWrap, ValueTypeNameForWrap> staticMap =
    new Map<KeyTypeNameForWrap, ValueTypeNameForWrap>();
  public static final Map<OuterKeyTypeThatWraps,
    Map<InnerKeyType, InnerValueType>> staticNestedMap =
    new Map<OuterKeyTypeThatWraps, Map<InnerKeyType, InnerValueType>>();

  public void parentMethod() {
    LongishTypeNameForWrap localInstance = new LongishTypeNameForWrap();
    LongishTypeNameForWrap localInstanceOne =
      new LongishTypeNameForWrap('one');
    LongishTypeNameForWrap localInstanceTwo =
      new LongishTypeNameForWrap('one', 'two');

    Set<LongishTypeNameForWrap> localSet = new Set<LongishTypeNameForWrap>();
    List<LongishTypeNameForWrap> localList =
      new List<LongishTypeNameForWrap>();
    Map<KeyTypeNameForWrap, ValueTypeNameForWrap> localMap =
      new Map<KeyTypeNameForWrap, ValueTypeNameForWrap>();
    Map<OuterKeyTypeThatWraps,
      Map<InnerKeyType, InnerValueType>> localNestedMap =
      new Map<OuterKeyTypeThatWraps, Map<InnerKeyType, InnerValueType>>();

    localSet = new Set<LongishTypeNameForWrap>();
    localList = new List<LongishTypeNameForWrap>();
    localMap = new Map<KeyTypeNameForWrap, ValueTypeNameForWrap>();
    localNestedMap =
      new Map<OuterKeyTypeThatWraps, Map<InnerKeyType, InnerValueType>>();
  }

  public class InnerWrappingTests {
    public void innerMethod() {
      LongishTypeNameForWrap innerInstance = new LongishTypeNameForWrap();
      LongishTypeNameForWrap innerInstanceOne =
        new LongishTypeNameForWrap('one');
      LongishTypeNameForWrap innerInstanceTwo =
        new LongishTypeNameForWrap('one', 'two');

      Set<LongishTypeNameForWrap> innerSet = new Set<LongishTypeNameForWrap>();
      List<LongishTypeNameForWrap> innerList =
        new List<LongishTypeNameForWrap>();
      Map<KeyTypeNameForWrap, ValueTypeNameForWrap> innerMap =
        new Map<KeyTypeNameForWrap, ValueTypeNameForWrap>();
      Map<OuterKeyTypeThatWraps,
        Map<InnerKeyType, InnerValueType>> innerNestedMap =
        new Map<OuterKeyTypeThatWraps, Map<InnerKeyType, InnerValueType>>();

      innerSet = new Set<LongishTypeNameForWrap>();
      innerList = new List<LongishTypeNameForWrap>();
      innerMap = new Map<KeyTypeNameForWrap, ValueTypeNameForWrap>();
      innerNestedMap =
        new Map<OuterKeyTypeThatWraps, Map<InnerKeyType, InnerValueType>>();
    }
  }
}
