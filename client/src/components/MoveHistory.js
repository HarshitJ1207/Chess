import React from "react";
import { Box, Paper, Typography, List, ListItem, ListItemText, Divider } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledListItem = styled(ListItem)(({ theme }) => ({
  "&:nth-of-type(odd)": {
    backgroundColor: theme.palette.action.hover,
  },
  padding: theme.spacing(1, 2),
}));

const MoveHistory = ({ pgn }) => {
    // Split the PGN string into individual moves
    const cleanPgn = pgn.split("]").pop().trim();
    const moves = cleanPgn.split(/\d+\./).filter(Boolean).map(move => move.trim());

    return (
        <Paper elevation={3} sx={{ maxHeight: 400, overflow: 'auto' }}>
            <Typography variant="h6" sx={{ p: 2, position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}>
                Move History
            </Typography>
            <Divider />
            <List dense>
                {moves.map((move, index) => {
                    const [white, black] = move.split(/\s+/);
                    return (
                        <React.Fragment key={index}>
                            <StyledListItem>
                                <ListItemText 
                                    primary={
                                        <Box display="flex" justifyContent="space-between">
                                            <Typography variant="body2" color="text.secondary" width="20%">
                                                {index + 1}.
                                            </Typography>
                                            <Typography variant="body2" fontWeight="medium" width="40%">
                                                {white}
                                            </Typography>
                                            <Typography variant="body2" fontWeight="medium" width="40%">
                                                {black}
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </StyledListItem>
                            {index < moves.length - 1 && <Divider component="li" />}
                        </React.Fragment>
                    );
                })}
            </List>
        </Paper>
    );
};

export default MoveHistory;