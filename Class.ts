
export class Class {
    public class_name: string;
    public methods: { [index: string]: ClassMethod } = {}
    public fields: { [index: string]: ClassField } = {}
    public constant_pool: ConstantPoolInfo[]
}

export class ClassMethod {
    public code: Buffer
    max_locals: number;
    max_stack: number;
    exception_table: any[];
    args_size: number;
}

export class ClassField {
    public type: Class
    static_value: any
}

// JVM Class spec
// https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html

export class ClassFile {
    minor_version: number;
    major_version: number;
    constant_pool: ConstantPoolInfo[];
    access_flags: object;
    this_class: number;
    super_class: number;
    interfaces_count: number;
    interfaces: number[];
    fields: MemberInfo[];
    method_info: MemberInfo[];
    attributes: AttributeInfo[];

    this_class_name: string;
}

export class ConstantPoolInfo {
    tag: number
    utf_val: string;
    int_val: number;
    float_val: number;
    long_val: number;
    double_val: number;
    string_index: number;
    name_index: number;
    class_index: number;
    name_and_type_index: number;
    descriptor_index: number;
    reference_kind: number;
    reference_index: number;
    /*
The value of the reference_index item must be a valid index into the constant_pool table.
If the value of the reference_kind item is 1 (REF_getField), 2 (REF_getStatic), 3 (REF_putField), or 4 (REF_putStatic), then the constant_pool entry at that index must be a CONSTANT_Fieldref_info (§4.4.2) structure representing a field for which a method handle is to be created.
If the value of the reference_kind item is 5 (REF_invokeVirtual), 6 (REF_invokeStatic), 7 (REF_invokeSpecial), or 8 (REF_newInvokeSpecial), then the constant_pool entry at that index must be a CONSTANT_Methodref_info structure (§4.4.2) representing a class's method or constructor (§2.9) for which a method handle is to be created.
If the value of the reference_kind item is 9 (REF_invokeInterface), then the constant_pool entry at that index must be a CONSTANT_InterfaceMethodref_info (§4.4.2) structure representing an interface's method for which a method handle is to be created.
If the value of the reference_kind item is 5 (REF_invokeVirtual), 6 (REF_invokeStatic), 7 (REF_invokeSpecial), or 9 (REF_invokeInterface), the name of the method represented by a CONSTANT_Methodref_info structure must not be <init> or <clinit>.
If the value is 8 (REF_newInvokeSpecial), the name of the method represented by a CONSTANT_Methodref_info structure must be <init>.
    */
    bootstrap_method_attr_index: number;
}

export class MemberInfo {
    access_flags: object;
    name_index: number;
    name: string;
    descriptor_index: number;
    descriptor: string;
    attributes: AttributeInfo[];
}

export class AttributeInfo {
    attribute_name_index: number;
    attribute_name: string;
    attribute_value: string;
    code_info: CodeInfo;
    line_number_table_info: LineNumberTableInfo[];
    stack_map_table_info: StackMapTableInfo[];
    inner_classes_info: InnerClassInfo[];
}

export class CodeInfo {
    max_stack: number;
    max_locals: number;
    code_length: number;
    code: Buffer;
    exception_table: any[];
    attributes: AttributeInfo[];
}

export class LineNumberTableInfo {
    start_pc: number;
    line_number: number;
}

export class StackMapTableInfo {

}

export class InnerClassInfo {
    inner_class_info_index: number;
    outer_class_info_index: number;
    inner_name_index: number;
    inner_class_access_flags: number;
}

export const ConstantPoolTagNames: string[] = [
    '', 'Utf8', '', 'Int', 'Float', 'Long', 'Double', 'Class', 'String',
    'Fieldref', 'Methodref', 'InterfaceMethodref', 'NameAndType'
]
