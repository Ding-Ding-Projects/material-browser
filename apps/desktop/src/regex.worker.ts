self.onmessage = ({ data }) => {
  const start = performance.now();
  try {
    const re = new RegExp(data.pattern, data.flags.replace(/g/g, "") + "g");
    const matches = [];
    let match;
    while ((match = re.exec(data.sample)) && matches.length < 200) {
      matches.push({
        index: match.index,
        text: match[0],
        groups: match.slice(1),
        named: match.groups || {},
      });
      if (!match[0]) re.lastIndex += 1;
    }
    const values = data.values?.map((value: string) => {
      re.lastIndex = 0;
      return re.test(value);
    });
    self.postMessage({
      matches,
      values,
      replacement: data.sample.replace(
        new RegExp(data.pattern, data.flags),
        data.replacement || "",
      ),
      ms: performance.now() - start,
    });
  } catch {
    self.postMessage({ error: "Invalid regular expression" });
  }
};
