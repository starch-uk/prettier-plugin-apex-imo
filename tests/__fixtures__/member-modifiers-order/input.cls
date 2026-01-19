public with sharing class ModifierOrderExample {
	static global transient final Integer field1;
	final private static Integer field2;
	transient protected static final Integer field3;
	static public Integer field4;
	transient global Integer field5;

	@AuraEnabled static public void method1() {}
	@AuraEnabled public static void method2() {}
	@AuraEnabled override public void method3() {}
	@AuraEnabled public override void method4() {}
	@AuraEnabled virtual public void method5() {}
	@AuraEnabled public virtual void method6() {}
	@AuraEnabled abstract public void method7();
	@AuraEnabled public abstract void method8();
	@AuraEnabled static global virtual override void method9() {}
	@AuraEnabled abstract private static override void method10();

	public class InnerClass {
		static global transient final Integer innerField1;
		final private static Integer innerField2;

		@AuraEnabled static public void innerMethod1() {}
		@AuraEnabled public static void innerMethod2() {}
		@AuraEnabled override public void innerMethod3() {}
		@AuraEnabled public override void innerMethod4() {}
		@AuraEnabled virtual public void innerMethod5() {}
		@AuraEnabled public virtual void innerMethod6() {}
		@AuraEnabled abstract public void innerMethod7();
		@AuraEnabled public abstract void innerMethod8();
	}
}

