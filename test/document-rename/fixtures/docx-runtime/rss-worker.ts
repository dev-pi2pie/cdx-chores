const retained = Buffer.alloc(160 * 1024 * 1024, 1);
while (true) {
  // Keep the external allocation resident and the parser thread occupied.
  retained[0] = retained[0]! ^ 1;
}
