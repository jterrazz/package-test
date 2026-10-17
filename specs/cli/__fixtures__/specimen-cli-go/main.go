// A Go program the cli runner meets as any other binary: argv in, stdout,
// stderr and an exit code out, and a file left in the directory it ran in.
package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: greet <name>")
		os.Exit(2)
	}
	greeting := fmt.Sprintf("Hello, %s.\n", os.Args[1])
	if err := os.WriteFile("greeting.txt", []byte(greeting), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Print(greeting)
}
