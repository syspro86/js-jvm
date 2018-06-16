import { Class, ClassMethod, ConstantPoolInfo } from "./Class";
import { ClassLoader, CompositeClassLoader, DefaultClassLoader } from "./ClassLoader";
import { BootClassLoader } from "./BootClassLoader";
import { JVMStack, JVMStackFrame } from "./JVMStack";
import * as util from "util"

function rpad(str, len) {
    if (str == null) str = ''
    if (str.length < len) {
        str += ' '.repeat(len - str.length)
    }
    return str
}

export class JVM {
    public static active: JVM
    public static debug: boolean = false
    private classLoader: ClassLoader = new CompositeClassLoader([
        new BootClassLoader(),
        new DefaultClassLoader(['sample'])
    ]);
    private frame: JVMStackFrame[] = []
    public heap: JVMObjectRef[] = [
        new JVMObjectRef(null)
    ]

    constructor() {
        JVM.active = this
    }

    public async start(mainClass: string): Promise<void> {
        this.initFrame(mainClass)
        // https://en.wikipedia.org/wiki/Java_bytecode_instruction_listings
        while (true) {
            try {
                var cur_frame: JVMStackFrame = this.frame[this.frame.length - 1]

                // debug info
                if (JVM.debug) {
                    console.log(rpad(cur_frame.clazz.class_name, 20) + rpad(cur_frame.method.signature, 50) + cur_frame.pc)
                    if (cur_frame.pc == 0) {
                        console.log(cur_frame.code != null ? cur_frame.code : 'native')
                    }
                }

                if (cur_frame.code_native != null) {
                    var args = []
                    for (var i = 0; i < cur_frame.method.args_size; i++) {
                        args.push(cur_frame.var_stack.readUInt(i))
                    }
                    var ret = await cur_frame.method.code_native.apply(cur_frame.clazz, args)
                    if (typeof ret == 'number') {
                        cur_frame.operand_stack.writeInt(ret)
                        this.code_ireturn(cur_frame)
                    } else {
                        this.code_return(cur_frame)
                    }
                    continue
                }

                var bytecode = cur_frame.code[cur_frame.pc]

                switch (bytecode) {
                    case 0x01: // aconst_null
                        cur_frame.operand_stack.writeInt(0)
                        cur_frame.pc++
                        break

                    case 0x09: // lconst_0
                        cur_frame.operand_stack.writeLong(0)
                        cur_frame.pc++
                        break

                    case 0x0a: // lconst_1
                        cur_frame.operand_stack.writeLong(1)
                        cur_frame.pc++
                        break

                    case 0x10: // bipush
                        this.code_bipush(cur_frame)
                        break

                    case 0x13: // ldc_w
                    case 0x14: // ldc2_w
                        this.code_ldc_w(cur_frame)
                        break

                    case 0x1a: // iload_0
                    case 0x1b: // iload_1
                    case 0x1c: // iload_2
                    case 0x1d: // iload_3
                        this.code_iload_n(cur_frame, bytecode - 0x1a)
                        break

                    case 0x1e: // lload_0
                    case 0x1f: // lload_1
                    case 0x20: // lload_2
                    case 0x21: // lload_3
                        this.code_lload_n(cur_frame, bytecode - 0x1e)
                        break

                    case 0x2a: // aload_0
                    case 0x2b: // aload_1
                    case 0x2c: // aload_2
                    case 0x2d: // aload_3
                        this.code_aload_n(cur_frame, bytecode - 0x2a)
                        break

                    case 0x3f: // lstore_0
                    case 0x40: // lstore_1
                    case 0x41: // lstore_2
                    case 0x42: // lstore_3
                        this.code_lstore_n(cur_frame, bytecode - 0x3f)
                        break

                    case 0x4b: // astore_0
                    case 0x4c: // astore_1
                    case 0x4d: // astore_2
                    case 0x4e: // astore_3
                        this.code_astore_n(cur_frame, bytecode - 0x4b)
                        break

                    case 0x57:
                        this.code_pop(cur_frame)
                        break

                    case 0x58:
                        this.code_pop2(cur_frame)
                        break

                    case 0x59: // dup
                        this.code_dup(cur_frame)
                        break

                    case 0x61: // ladd
                        this.code_ladd(cur_frame)
                        break

                    case 0x85: // i2l
                        cur_frame.operand_stack.writeLong(cur_frame.operand_stack.readInt())
                        cur_frame.pc++
                        break

                    case 0x86: // i2f
                        cur_frame.operand_stack.writeFloat(cur_frame.operand_stack.readInt())
                        cur_frame.pc++
                        break

                    case 0x87: // i2d
                        cur_frame.operand_stack.writeDouble(cur_frame.operand_stack.readInt())
                        cur_frame.pc++
                        break

                    case 0x88: // l2i
                        cur_frame.operand_stack.writeInt(cur_frame.operand_stack.readLong())
                        cur_frame.pc++
                        break

                    case 0x89: // l2f
                        cur_frame.operand_stack.writeFloat(cur_frame.operand_stack.readLong())
                        cur_frame.pc++
                        break

                    case 0x8a: // l2d
                        cur_frame.operand_stack.writeDouble(cur_frame.operand_stack.readLong())
                        cur_frame.pc++
                        break
                    
                    case 0x91: // i2b
                        cur_frame.operand_stack.writeInt(cur_frame.operand_stack.readInt() & 0xff)
                        cur_frame.pc++
                        break

                    case 0x92: // i2c
                    case 0x93: // i2s
                        cur_frame.operand_stack.writeInt(cur_frame.operand_stack.readInt() & 0xffff)
                        cur_frame.pc++
                        break

                    case 0x97: // dcmpl
                        cur_frame.operand_stack.writeInt(cur_frame.operand_stack.readDouble() == cur_frame.operand_stack.readDouble() ? 0 : 1)
                        cur_frame.pc++
                        break

                    case 0x9a: // ifne
                        this.code_ifne(cur_frame)
                        break

                    case 0xaf: // dreturn
                        this.code_dreturn(cur_frame)
                        break

                    case 0xb1:
                        this.code_return(cur_frame)
                        break

                    case 0xb2:
                        await this.code_getstatic(cur_frame)
                        break

                    case 0xb3:
                        await this.code_putstatic(cur_frame)
                        break

                    case 0xb6:
                        await this.code_invokevirtual(cur_frame)
                        break

                    case 0xb7:
                        await this.code_invokespecial(cur_frame)
                        break

                    case 0xb8:
                        await this.code_invokestatic(cur_frame)
                        break

                    case 0xb9:
                        await this.code_invokeinterface(cur_frame)
                        break

                    case 0xbb: // new
                        await this.code_new(cur_frame)
                        break

                    case 0xca: // breakpoint
                        return

                    default:
                        throw new Error("Not implemented " + (typeof bytecode == 'number' ? bytecode.toString(16) : '?') + " @ " + cur_frame.pc)
                }
            } catch (e) {
                if (e instanceof ClassLoadException) {
                    continue
                } else if (e instanceof ClassNotFoundException) {
                    this.printStackTrace(e)
                    break
                } else {
                    this.printStackTrace(e)
                    console.error(e)
                    break
                }
            }
        }
    }

    private printStackTrace(e: Error): void {
        console.error(e.name + ': ' + e.message)
        this.frame.slice().reverse().forEach(frame => {
            console.error('\tat ' + frame.clazz.class_name + '.' + frame.method.signature + ':' + frame.pc)
        })
    }

    private async new_frame(class_name: string, method_name: string): Promise<void> {
        var cur_frame: JVMStackFrame = this.frame[this.frame.length - 1]
        var new_frame: JVMStackFrame = new JVMStackFrame()
        new_frame.clazz = await this.get_class(class_name)
        new_frame.method = new_frame.clazz.methods[method_name]

        if (new_frame.method == null) {
            throw new NoSuchMethodException(class_name + ' ' + method_name)
        }

        // if (new_frame.method.code != null) {
            new_frame.code = new_frame.method.code
            new_frame.code_native = new_frame.method.code_native
            if (new_frame.code != null) {
                new_frame.operand_stack = new JVMStack(new_frame.method.max_stack * 4)
                new_frame.var_stack = new JVMStack(new_frame.method.max_locals * 4)
            } else if (new_frame.code_native != null) {
                new_frame.operand_stack = new JVMStack(8)
                new_frame.var_stack = new JVMStack(new_frame.method.args_size * 4)
            }
            for (var i = new_frame.method.args_size - 1; i >= 0; i--) {
                new_frame.var_stack.writeUInt(cur_frame.operand_stack.readUInt(), i)
            }
            this.frame.push(new_frame)
        // } else if (new_frame.method.code_native != null) {
            // var args = []
            // for (var i = new_frame.method.args_size - 1; i >= 0; i--) {
                // args.push(cur_frame.operand_stack.readUInt())
            // }
            // args.reverse()
            // if (new_frame.method.access_flags.acc_static) {
                // new_frame.method.code_native.call(null)
            // } else {
                // new_frame.method.code_native.call(null)
            // }
        // }
    }

    public async get_class(class_name: string): Promise<Class> {
        var { clazz, cached } = await this.classLoader.loadClass(class_name)
        if (clazz == null) {
            throw new ClassNotFoundException(class_name)
        }
        if (!cached) {
            if ("<clinit>()V" in clazz.methods) {
                await this.new_frame(class_name, "<clinit>()V")
                throw new ClassLoadException()
            }
        }
        return clazz
    }

    public async alloc_instance(class_name: string): Promise<number> {
        var obj = new JVMObjectRef(await this.get_class(class_name))
        var id = this.heap.push(obj) - 1
        return id
    }

    private code_bipush(cur_frame: JVMStackFrame): void {
        var value = cur_frame.code[cur_frame.pc + 1]
        cur_frame.operand_stack.writeInt(value)
        cur_frame.pc += 2
    }

    private code_ldc_w(cur_frame: JVMStackFrame): void {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2

        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool
        var const_ref: ConstantPoolInfo = cp[index]
        var value: number
        if (const_ref.tag == 5) {
            value = const_ref.long_val
            cur_frame.operand_stack.writeLong(value)
        } else if (const_ref.tag == 6) {
            value = const_ref.double_val
            cur_frame.operand_stack.writeDouble(value)
        }
        cur_frame.pc += 3
    }

    private code_iload_n(cur_frame: JVMStackFrame, local: number): void {
        var val = cur_frame.var_stack.readInt(local)
        cur_frame.operand_stack.writeInt(val)
        cur_frame.pc++
    }

    private code_lload_n(cur_frame: JVMStackFrame, local: number): void {
        var val = cur_frame.var_stack.readLong(local)
        cur_frame.operand_stack.writeLong(val)
        cur_frame.pc++
    }

    private code_aload_n(cur_frame: JVMStackFrame, local: number): void {
        var val = cur_frame.var_stack.readUInt(local)
        cur_frame.operand_stack.writeUInt(val)
        cur_frame.pc++
    }
    
    private code_lstore_n(cur_frame: JVMStackFrame, local: number): void {
        var val = cur_frame.operand_stack.readLong()
        cur_frame.var_stack.writeLong(val, local)
        cur_frame.pc++
    }

    private code_astore_n(cur_frame: JVMStackFrame, local: number): void {
        var val = cur_frame.operand_stack.readUInt()
        cur_frame.var_stack.writeUInt(val, local)
        cur_frame.pc++
    }

    private code_pop(cur_frame: JVMStackFrame): void {
        cur_frame.operand_stack.readUInt()
        cur_frame.pc++
    }

    private code_pop2(cur_frame: JVMStackFrame): void {
        cur_frame.operand_stack.readLong()
        cur_frame.pc++
    }

    private code_dup(cur_frame: JVMStackFrame): void {
        var val = cur_frame.operand_stack.readUInt()
        cur_frame.operand_stack.writeUInt(val)
        cur_frame.operand_stack.writeUInt(val)
        cur_frame.pc++
    }

    private code_ladd(cur_frame: JVMStackFrame): void {
        var val = cur_frame.operand_stack.readLong()
        var val2 = cur_frame.operand_stack.readLong()
        cur_frame.operand_stack.writeLong(val + val2)
        cur_frame.pc++
    }
    
    private code_ifne(cur_frame: JVMStackFrame): void {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2

        var val = cur_frame.operand_stack.readInt()
        if (val != 0) {
            cur_frame.pc += index
        } else {
            cur_frame.pc += 3
        }
    }

    private code_dreturn(cur_frame: JVMStackFrame): void {
        var val = cur_frame.operand_stack.readDouble()
        this.frame.pop()
        cur_frame = this.frame[this.frame.length - 1]
        cur_frame.operand_stack.writeDouble(val)
    }

    private code_ireturn(cur_frame: JVMStackFrame): void {
        var val = cur_frame.operand_stack.readInt()
        this.frame.pop()
        cur_frame = this.frame[this.frame.length - 1]
        cur_frame.operand_stack.writeInt(val)
    }

    private code_return(cur_frame: JVMStackFrame): void {
        this.frame.pop()
    }

    private async code_getstatic(cur_frame: JVMStackFrame): Promise<void> {
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

        var clazz: Class = await this.get_class(class_name)
        cur_frame.operand_stack.writeInt(clazz.fields[name].static_value)

        cur_frame.pc += 3
    }

    private async code_putstatic(cur_frame: JVMStackFrame): Promise<void> {
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

        var clazz: Class = await this.get_class(class_name)
        if (type == 'J') {
            clazz.fields[name].static_value = cur_frame.operand_stack.readLong()
        } else {
            clazz.fields[name].static_value = cur_frame.operand_stack.readInt()
        }

        cur_frame.pc += 3
    }

    private async code_invokevirtual(cur_frame: JVMStackFrame): Promise<void> {
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

        await this.new_frame(class_name, name + type)
        cur_frame.pc += 3
    }
    private async code_invokespecial(cur_frame: JVMStackFrame): Promise<void> {
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

        await this.new_frame(class_name, name + type)
        cur_frame.pc += 3
    }

    private async code_invokestatic(cur_frame: JVMStackFrame): Promise<void> {
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

        await this.new_frame(class_name, name + type)
        cur_frame.pc += 3
    }

    private async code_invokeinterface(cur_frame: JVMStackFrame): Promise<void> {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index3 = cur_frame.code[cur_frame.pc + 3]
        var index4 = cur_frame.code[cur_frame.pc + 4]
        var index = (index1 << 8) | index2

        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool
        var method_ref: ConstantPoolInfo = cp[index]
        var class_info: ConstantPoolInfo = cp[method_ref.class_index]
        var class_name: string = cp[class_info.name_index].utf_val
        var name_and_type: ConstantPoolInfo = cp[method_ref.name_and_type_index]
        var name: string = cp[name_and_type.name_index].utf_val
        var type: string = cp[name_and_type.descriptor_index].utf_val

        await this.new_frame(class_name, name + type)
        cur_frame.pc += 5
    }

    private async code_new(cur_frame: JVMStackFrame): Promise<void> {
        var index1 = cur_frame.code[cur_frame.pc + 1]
        var index2 = cur_frame.code[cur_frame.pc + 2]
        var index = (index1 << 8) | index2

        var cp: ConstantPoolInfo[] = cur_frame.clazz.constant_pool
        var class_ref: ConstantPoolInfo = cp[index]
        var class_name: string = cp[class_ref.name_index].utf_val

        var id = await this.alloc_instance(class_name)
        cur_frame.operand_stack.writeInt(id)

        cur_frame.pc += 3
    }

    private initFrame(mainClass: string): void {
        var boot_frame = new JVMStackFrame()
        boot_frame.clazz = new BootClass(mainClass)
        boot_frame.method = boot_frame.clazz.methods['<clinit>()V']
        boot_frame.code = boot_frame.method.code
        boot_frame.operand_stack = new JVMStack(10)
        boot_frame.var_stack = new JVMStack(10)
        this.frame.push(boot_frame)
    }
}

// stop current instruction and call <clinit> method
const ClassNotFoundException = function (message?) {
    Error.captureStackTrace(this, this.constructor)
    this.name = this.constructor.name
    this.message = 'Class Not Found ' + message
}
util.inherits(ClassNotFoundException, Error)

// stop current instruction and call <clinit> method
const ClassLoadException = function () {
    Error.captureStackTrace(this, this.constructor)
    this.name = this.constructor.name
}
util.inherits(ClassLoadException, Error)

// stop current instruction and call <clinit> method
const NoSuchMethodException = function (message?) {
    Error.captureStackTrace(this, this.constructor)
    this.name = this.constructor.name
    this.message = 'No Such Method ' + message
}
util.inherits(NoSuchMethodException, Error)


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

        this.class_name = '$VM$'
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

        var code = new Uint8Array(5)
        code[0] = 0x01
        code[1] = 0xb8
        code[2] = 0x00
        code[3] = 0x06
        code[4] = 0xca

        this.methods['<clinit>()V'] = new ClassMethod()
        this.methods['<clinit>()V'].code = Buffer.from(code)
    }
}

export class JVMObjectRef {
    instance: object
    
    constructor(public clazz: Class) {
        if (this.clazz != null) {
            this.instance = {}
        }
    }
}
