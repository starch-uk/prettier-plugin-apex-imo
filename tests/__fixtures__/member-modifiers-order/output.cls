public with sharing class ModifierOrderExample {
  global static final transient Integer field1;
  private static final Integer field2;
  protected static final transient Integer field3;
  public static Integer field4;
  global transient Integer field5;

  @AuraEnabled
  public static void method1() {}

  @AuraEnabled
  public static void method2() {}

  @AuraEnabled
  public override void method3() {}

  @AuraEnabled
  public override void method4() {}

  @AuraEnabled
  public virtual void method5() {}

  @AuraEnabled
  public virtual void method6() {}

  @AuraEnabled
  public abstract void method7();

  @AuraEnabled
  public abstract void method8();

  @AuraEnabled
  global static override virtual void method9() {}

  @AuraEnabled
  private static override abstract void method10();

  public class InnerClass {
    global static final transient Integer innerField1;
    private static final Integer innerField2;

    @AuraEnabled
    public static void innerMethod1() {}

    @AuraEnabled
    public static void innerMethod2() {}

    @AuraEnabled
    public override void innerMethod3() {}

    @AuraEnabled
    public override void innerMethod4() {}

    @AuraEnabled
    public virtual void innerMethod5() {}

    @AuraEnabled
    public virtual void innerMethod6() {}

    @AuraEnabled
    public abstract void innerMethod7();

    @AuraEnabled
    public abstract void innerMethod8();
  }
}
