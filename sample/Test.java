public class Test {

    private int a;
    private static long b;
    private String c;

    static class A implements Iterable<String> {
        @Override
        public java.util.Iterator<String> iterator() {return null;}
    }

    protected static double add(int a, long b) {
        return a + b;
    }

    public static void main(String[] args) {
        //System.out.println("Hello, world!");
        long e = 0;

        if (add(10, 20L) == 30D) {
            //System.out.println(30f);
            e = 10;
        }

        Iterable<String> i = new Test.A();
        i.iterator();

        System.out.println(e + e);
    }
}

class Test2 {
    public void a() {}
    private int b() {return 1;}
    protected static String c(Object o) {return "";}
}