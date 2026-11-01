/** Validate typed changes without converting empty input to zero or unknown values to defaults. */
export function propertyChange(descriptor, input) {
  if (!descriptor.available) return { error: 'This property is unavailable for the selected version.' };
  if (descriptor.control === 'switch') return typeof input === 'boolean' ? { value: input } : { error: 'Choose a boolean value.' };
  if (descriptor.control === 'choice') return descriptor.choices?.includes(input) ? { value: input } : { error: 'Choose a listed value.' };
  if (descriptor.control === 'number') {
    if (input === '' || input === null || typeof input === 'boolean') return { error: 'Enter a whole number within the displayed range.' };
    const value = Number(input);
    const min = descriptor.key === 'server-port' ? Math.max(1024, descriptor.min ?? 1024) : descriptor.min;
    if (!Number.isSafeInteger(value) || (min !== undefined && value < min) || (descriptor.max !== undefined && value > descriptor.max)) return { error: 'Enter a whole number within the displayed range.' };
    if (descriptor.step && ((value - (min ?? 0)) % descriptor.step)) return { error: 'Use the displayed step size.' };
    return { value };
  }
  if (descriptor.control === 'text') {
    if (typeof input !== 'string' || /[\r\n\0]/.test(input) || input.length > (descriptor.maxLength ?? 4096)) return { error: 'Text exceeds this property’s limits.' };
    if (descriptor.pattern) {
      try { if (!new RegExp(descriptor.pattern).test(input)) return { error: 'Text does not match the supported format.' }; }
      catch { return { error: 'The property descriptor is invalid.' }; }
    }
    return { value: input };
  }
  return { error: 'No control for this setting' };
}
