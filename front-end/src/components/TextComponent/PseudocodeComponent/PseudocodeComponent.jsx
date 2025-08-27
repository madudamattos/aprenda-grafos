import React from 'react'
import '../TextComponent.css'
import { useLocation } from 'react-router-dom';
import pseudocodigos from '../../../mocks/pseudocodigos.json'

const PseudocodeComponent = ({routeName, step=0}) => {
    const location = useLocation();
    const selectedPseudocodigo = pseudocodigos.find(p => p.id === routeName);

    // Função para retornar o intervalo de linhas selecionadas conforme o step
    const getSelectedRange = () => {
      if(routeName == 'bfs'){
        if (step === 1) return [1, 9];
        if (step === 2) return [10, 12];
        if (step === 3) return [13, 18];
        if (step === 4) return [19];
      }
      return [null, null];
    };

    const [start, end] = getSelectedRange();

    return (
      <div className='code_body_text_pseudocode'>
          {selectedPseudocodigo.content && selectedPseudocodigo.content.length > 0 &&
            Object.keys(selectedPseudocodigo.content[0])
              .sort((a, b) => {
                const numA = parseInt(a.replace('p', ''));
                const numB = parseInt(b.replace('p', ''));
                return numA - numB;
              })
              .map((key) => {
                const numKey = parseInt(key.replace('p', ''));
                const isSelected = start !== null && end !== null && numKey >= start && numKey <= end;
                return (
                  <pre key={key} className={`code_line${isSelected ? '-selected' : ''}`}>
                    {selectedPseudocodigo.content[0][key]}
                  </pre>
                );
              })
          }
      </div>
  )
}

export default PseudocodeComponent
