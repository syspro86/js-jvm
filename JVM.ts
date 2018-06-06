import { Class, ClassMethod, ConstantPoolInfo } from "./Class";
import { ClassLoader } from "./ClassLoader";

export class JVM {
    private classLoader: ClassLoader = new ClassLoader();
    private frame: StackFrame[] = []
    private stack: any[] = []
    private heap: any[] = []

    public start(mainClass: string): void {
        var boot_frame = new StackFrame()
        boot_frame.clazz = new BootClass(mainClass)
        boot_frame.method = boot_frame.clazz.methods['<clinit>()V']
        boot_frame.code = boot_frame.method.code
        this.frame.push(boot_frame)

        // https://en.wikipedia.org/wiki/Java_bytecode_instruction_listings
        while (true) {
            var cur_frame: StackFrame = this.frame[this.frame.length - 1]

            var bytecode = cur_frame.code[cur_frame.pc]

            try {
                switch (bytecode) {
                    case 0x01: // aconst_null
                        this.stack.push(null)
                        cur_frame.pc++
                        break

                    case 0x09: // lconst_0
                        this.stack.push(0)
                        cur_frame.pc++
                        break

                    case 0x0a: // lconst_1
                        this.stack.push(1)
                        cur_frame.pc++
                        break

                    case 0x3f: // lstore_0
                    case 0x40: // lstore_1
                    case 0x41: // lstore_2
                    case 0x42: // lstore_3
                        this.code_lstore_n(cur_frame, bytecode - 0x3f)
                        break

                    case 0xb2:
                        this.code_getstatic(cur_frame)
                        break
    
                    case 0xb8:
                        this.code_invokestatic(cur_frame)
                        break
                }
            } catch (e) {
                if (e instanceof ClassLoadException) {
                    continue
                } else {
                    console.error(e)
                    break
                }
            }
        }
    }

    private new_frame(class_name: string, method_name: string): void {
        var new_frame: StackFrame = new StackFrame()
        new_frame.clazz = this.get_class(class_name)
        new_frame.method = new_frame.clazz.methods[method_name]
        new_frame.code = new_frame.method.code
        new_frame.sp = this.stack.length - new_frame.method.args_size
        for (var i = 0; i < new_frame.method.max_locals; i++) {
            this.stack.push(0)
        }
        this.frame.push(new_frame)
    }

    private get_class(class_name: string): Class {
        var { clazz, cached } = this.classLoader.loadClass(class_name)
        if (!cached) {
            if ("<clinit>()V" in clazz.methods) {
                this.new_frame(class_name, "<clinit>()V")
                throw new ClassLoadException()
            }
        }
        return clazz
    }
    
    private code_lstore_n(cur_frame: StackFrame, local: number): void {
        var st_index = cur_frame.sp + local
        this.stack[st_index] = this.stack.pop()
        cur_frame.pc++
    }

    private code_getstatic(cur_frame: StackFrame): void {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2
        
        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool
        
        var field_ref: ConstantPoolInfo = cp[index]
        var class_info: ConstantPoolInfo = cp[field_ref.class_index]
        var class_name: string = cp[class_info.name_index].utf_val
        var name_and_type: ConstantPoolInfo = cp[field_ref.name_and_type_index]
        var name: string = cp[name_and_type.name_index].utf_val
        var type: string = cp[name_and_type.descriptor_index].utf_val
        
        var clazz: Class = this.get_class(class_name)
        this.stack.push(clazz.fields[name].static_value)

        cur_frame.pc += 3
    }

    private code_invokestatic(cur_frame: StackFrame): void {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2
        
        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool
        
        var method_ref: ConstantPoolInfo = cp[index]
        var class_info: ConstantPoolInfo = cp[method_ref.class_index]
        var class_name: string = cp[class_info.name_index].utf_val
        var name_and_type: ConstantPoolInfo = cp[method_ref.name_and_type_index]
        var name: string = cp[name_and_type.name_index].utf_val
        var type: string = cp[name_and_type.descriptor_index].utf_val
        
        this.new_frame(class_name, name + type)
        
        cur_frame.pc += 3
    }
}

// stop current instruction and call <clinit> method
class ClassLoadException extends Error {
}

class StackFrame {
    locals: any[] = []
    code: Buffer = null
    pc: number = 0
    sp: number = 0
    clazz: Class = null
    method: ClassMethod = null
}

class BootClass extends Class {
    /*
    class BootClass {
        static {
            $main_class.main((java.lang.String[])null);
        }
    }
    */
    constructor(public main_class: string) {
        super()

        this.constant_pool = new Array<ConstantPoolInfo>(7)
        this.constant_pool[1] = new ConstantPoolInfo()
        this.constant_pool[1].tag = 1
        this.constant_pool[1].utf_val = main_class
        this.constant_pool[2] = new ConstantPoolInfo()
        this.constant_pool[2].tag = 1
        this.constant_pool[2].utf_val = 'main'
        this.constant_pool[3] = new ConstantPoolInfo()
        this.constant_pool[3].tag = 1
        this.constant_pool[3].utf_val = '([Ljava/lang/String;)V'
        this.constant_pool[4] = new ConstantPoolInfo()
        this.constant_pool[4].tag = 7
        this.constant_pool[4].name_index = 1
        this.constant_pool[5] = new ConstantPoolInfo()
        this.constant_pool[5].tag = 12
        this.constant_pool[5].name_index = 2
        this.constant_pool[5].descriptor_index = 3
        this.constant_pool[6] = new ConstantPoolInfo()
        this.constant_pool[6].tag = 10
        this.constant_pool[6].class_index = 4
        this.constant_pool[6].name_and_type_index = 5

        var code = new Uint8Array(4)
        code[0] = 0x01
        code[1] = 0xb8
        code[2] = 0x00
        code[3] = 0x06

        this.methods['<clinit>()V'] = new ClassMethod()
        this.methods['<clinit>()V'].code = Buffer.from(code)
    }
}
