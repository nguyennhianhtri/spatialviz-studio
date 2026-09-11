import { validateDesign, type InteriorDesign } from './interior-design';
export function bundleInteriors(project:string,design:InteriorDesign):string{
 const valid=validateDesign(design);if(!valid)throw new Error('Could not save invalid interior design.');
 const data=JSON.parse(project);
 return JSON.stringify({...data,interiors:data.scene===null?{items:[],finishes:{}}:valid});
}
export function readInteriors(project:string):InteriorDesign|null{
 const value=JSON.parse(project).interiors;if(value===undefined)return null;
 const valid=validateDesign(value);if(!valid)throw new Error('The project contains invalid furnishings. Nothing was replaced.');
 return valid;
}
