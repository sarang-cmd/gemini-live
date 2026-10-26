import { GROQ_VOICES } from '../../../electron/catalog';
import { VOICES } from '../../../shared/voices.js';

interface Row {
  name: string;
  descriptor: string;
  gender: string;
}

const gemini: Row[] = VOICES.map((voice) => ({
  name: voice.name,
  descriptor: voice.descriptor,
  gender: voice.gender,
}));

const groq: Row[] = GROQ_VOICES.filter(
  (voice) => voice.model === 'canopylabs/orpheus-v1-english',
).map((voice) => ({ name: voice.label, descriptor: 'Orpheus', gender: voice.gender }));

export function VoiceTable() {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-12">
      <div>
        <h3 style={{ fontSize: 'var(--step-2)', marginBottom: '0.75rem' }}>Gemini Live</h3>
        <p className="small" style={{ marginBottom: '1.25rem' }}>
          {gemini.length} prebuilt voices, with the descriptor Google gives each one.
        </p>
        <table className="voice-table">
          <thead>
            <tr>
              <th scope="col">Voice</th>
              <th scope="col">Sounds like</th>
              <th scope="col">Gender</th>
            </tr>
          </thead>
          <tbody>
            {gemini.map((voice) => (
              <tr key={voice.name}>
                <td>{voice.name}</td>
                <td>{voice.descriptor}</td>
                <td>{voice.gender}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 style={{ fontSize: 'var(--step-2)', marginBottom: '0.75rem' }}>Groq Orpheus</h3>
        <p className="small" style={{ marginBottom: '1.25rem' }}>
          {groq.length} English voices on the Groq side, with four more in Arabic Saudi.
        </p>
        <table className="voice-table">
          <thead>
            <tr>
              <th scope="col">Voice</th>
              <th scope="col">Model</th>
              <th scope="col">Gender</th>
            </tr>
          </thead>
          <tbody>
            {groq.map((voice) => (
              <tr key={voice.name}>
                <td>{voice.name}</td>
                <td>{voice.descriptor}</td>
                <td>{voice.gender}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
