// Lo poco de `node:sqlite` que usa `verifica.ts`. Se declara a mano en vez de instalar
// @types/node, que mezclaría los tipos de Node con los de React Native en toda la app.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(ruta: string);
    exec(sql: string): void;
    prepare(sql: string): { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown };
  }
}
