import React, { createContext} from 'react';
import Chess from 'chess.js';

// Create a context
const BoardContext = createContext();

// Create a provider component
const BoardProvider = ({ children }) => {
    const reverseTurnInFen = (fen) => {
        return fen.replace(/ (w|b) /, (match, color) => ` ${color === 'w' ? 'b' : 'w'} `);
    };

    const validateBoardState = (chess) => {
        // Check if both kings exist
        const whiteKingExists = chess.board().flat().some(piece => piece && piece.type === 'k' && piece.color === 'w');
        const blackKingExists = chess.board().flat().some(piece => piece && piece.type === 'k' && piece.color === 'b');
    
        if (!whiteKingExists || !blackKingExists) {
            console.log("king missing");
            return false; // Invalid state if either king is missing
        }
    
        // Check if the game is already over
        if (chess.game_over()) { 
            console.log("game over");
            return false; // Invalid state if the game is already over
        }
    
        const tempChess = new Chess(reverseTurnInFen(chess.fen()));
        if (tempChess.in_check()) {
            console.log("player not in turn in check");
            return false; 
        }
    
        return true; // Valid state if all checks pass
    };

    return (
        <BoardContext.Provider value={{validateBoardState, reverseTurnInFen }}>
            {children}
        </BoardContext.Provider>
    );
};

export { BoardContext, BoardProvider }; 