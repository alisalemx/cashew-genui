// Vite inlines a file imported with ?raw as a string, like the components guide.
declare module "*?raw" {
  const content: string
  export default content
}
