import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SoapNoteDto } from './soap-note.dto';

const VALID_SOAP_NOTE = {
  subjective: 'Patient reports dizziness.',
  objective: 'BP 150/95, HR 88.',
  assessment: 'Suspected hypertension.',
  plan: 'Start lisinopril, follow up in 2 weeks.',
};

async function validateSoapNote(
  plain: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(SoapNoteDto, plain);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('SoapNoteDto', () => {
  it('accepts a fully-populated SOAP note', async () => {
    expect(await validateSoapNote(VALID_SOAP_NOTE)).toEqual([]);
  });

  it.each(['subjective', 'objective', 'assessment', 'plan'])(
    'rejects a missing %s field',
    async (field) => {
      const errors = await validateSoapNote({
        ...VALID_SOAP_NOTE,
        [field]: undefined,
      });
      expect(errors).toContain(field);
    },
  );

  it.each(['subjective', 'objective', 'assessment', 'plan'])(
    'rejects an empty %s field',
    async (field) => {
      const errors = await validateSoapNote({
        ...VALID_SOAP_NOTE,
        [field]: '',
      });
      expect(errors).toContain(field);
    },
  );
});
