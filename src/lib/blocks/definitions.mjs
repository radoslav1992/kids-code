const value=(name,check)=>({type:'input_value',name,...(check?{check}:{})});
const field=(name,text)=>({type:'field_input',name,text});
const menu=(name,options)=>({type:'field_dropdown',name,options});
const body=name=>({type:'input_statement',name});
const expression=(type,message,args,colour,output=null)=>({type:'kc_'+type,message0:message,args0:args,colour,output,inputsInline:true});
const statement=(type,message,args,colour)=>({type:'kc_'+type,message0:message,args0:args,colour,previousStatement:null,nextStatement:null,inputsInline:true});
export const definitions=[
{type:'kc_start',message0:'when I press Run %1',args0:[body('DO')],colour:42,tooltip:'Connect the instructions you want to run inside this block.'},
statement('say','Bit says %1',[value('VALUE')],165),
expression('number','%1',[{type:'field_number',name:'VALUE',value:1,min:-1000000,max:1000000}],220,'Number'),
expression('text','“ %1 ”',[field('VALUE','Hello!')],165,'String'),
expression('boolean','%1',[menu('VALUE',[['true','true'],['false','false']])],200,'Boolean'),
expression('nothing','nothing',[],200),
expression('kind','type of %1',[value('VALUE')],200,'String'),
statement('set','set %1 to %2',[field('NAME','score'),value('VALUE')],28),
expression('get','value of %1',[field('NAME','score')],28),
expression('input','input %1',[field('NAME','keys')],28),
expression('math','%1 %2 %3',[value('A','Number'),menu('OP',[['+','+'],['−','-'],['×','*'],['÷','/'],['remainder','%']]),value('B','Number')],220,'Number'),
expression('join','join %1 and %2',[value('A'),value('B')],165,'String'),
expression('compare','%1 %2 %3',[value('A'),menu('OP',[['=','='],['≠','!='],['<','<'],['≤','<='],['>','>'],['≥','>=']]),value('B')],200,'Boolean'),
expression('logic','%1 %2 %3',[value('A','Boolean'),menu('OP',[['and','and'],['or','or']]),value('B','Boolean')],200,'Boolean'),
expression('not','not %1',[value('VALUE','Boolean')],200,'Boolean'),
statement('if','if %1 then %2 else %3',[value('TEST','Boolean'),body('THEN'),body('ELSE')],200),
statement('repeat','repeat %1 times %2',[value('COUNT','Number'),body('DO')],100),
statement('while','while %1 repeat %2',[value('TEST','Boolean'),body('DO')],100),
statement('each','for each %1 in %2 %3',[field('NAME','item'),value('LIST','Array'),body('DO')],100),
expression('list','list %1 %2 %3',[value('A'),value('B'),value('C')],345,'Array'),
expression('empty_list','empty list',[],345,'Array'),
expression('at','item at index %1 in %2',[value('INDEX','Number'),value('LIST','Array')],345),
expression('length','length of %1',[value('VALUE')],345,'Number'),
statement('append','add %1 to end of %2',[value('VALUE'),value('LIST','Array')],345),
expression('take','take %1 item from %2',[menu('END',[['last','last'],['first','first']]),value('LIST','Array')],345),
expression('record','record %1 : %2 %3 : %4',[field('KEY1','name'),value('A'),field('KEY2','energy'),value('B')],20,'Record'),
expression('lookup','value of key %1 in %2',[field('KEY','energy'),value('RECORD','Record')],20),
statement('update','set key %1 in %2 to %3',[field('KEY','energy'),value('RECORD','Record'),value('VALUE')],20),
{type:'kc_define',message0:'define recipe %1 %2',args0:[field('NAME','celebrate'),body('DO')],colour:285,tooltip:'A reusable group of instructions. A call block runs this recipe.'},
statement('call','run recipe %1',[field('NAME','celebrate')],285)
];
export const categories=[
{name:'Start & say',colour:'#168b72',types:['start','say','text','join']},
{name:'Values & math',colour:'#457abb',types:['number','boolean','nothing','kind','math']},
{name:'Variables',colour:'#bb7130',types:['set','get','input']},
{name:'Decisions',colour:'#428797',types:['if','compare','logic','not']},
{name:'Loops',colour:'#6a952d',types:['repeat','while','each']},
{name:'Lists',colour:'#b4527a',types:['list','empty_list','at','length','append','take']},
{name:'Records',colour:'#b76e42',types:['record','lookup','update']},
{name:'Recipes',colour:'#8766a1',types:['define','call']}
];
export function registerBlocks(Blockly){if(!Blockly.Blocks.kc_start)Blockly.defineBlocksWithJsonArray(definitions);}
export function toolbox(allowed){return {kind:'categoryToolbox',contents:categories.map(c=>({kind:'category',name:c.name,colour:c.colour,contents:c.types.filter(t=>!allowed||allowed.includes(t)).map(type=>({kind:'block',type:'kc_'+type}))})).filter(c=>c.contents.length)};}
// Validate saved projects before passing them into Blockly's deserializer.
export function validateState(state){let count=0;const allowed=new Set(definitions.map(d=>d.type));if(!state||typeof state!=='object'||!state.blocks||!Array.isArray(state.blocks.blocks))throw Error('This is not a Kids Code block project.');function visit(b,depth=0){if(depth>50||++count>250)throw Error('This project is too large. Keep it under 250 blocks and 50 layers.');if(!allowed.has(b.type))throw Error('This project contains an unsupported block.');for(const input of Object.values(b.inputs||{})){if(input.block)visit(input.block,depth+1);if(input.shadow)visit(input.shadow,depth+1);}if(b.next?.block)visit(b.next.block,depth+1);}state.blocks.blocks.forEach(b=>visit(b));return state;}
