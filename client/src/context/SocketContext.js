import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    console.log("socket provider rendered");
    const uuid = localStorage.getItem("uuid") || uuidv4();
    localStorage.setItem("uuid", uuid);

    const [socket, setSocket] = useState(io);

    useEffect(() => {
        const newSocket = io(process.env.REACT_APP_API_WS_URL, {
            query: { uuid },
        });

        newSocket.on("connect", () => {
            console.log("socket connected");
            setSocket(newSocket);
        });

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [uuid]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};