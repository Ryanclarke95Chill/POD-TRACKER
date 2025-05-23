import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { axylogAPI } from "./axylog";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET_KEY = process.env.JWT_SECRET || "chilltrack-secret-key";
const USE_AXYLOG_API = process.env.USE_AXYLOG_API === "true";

interface AuthRequest extends Request {
  user?: { id: number; email: string };
}

// Authentication middleware
const authenticate = async (req: AuthRequest, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No authentication token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY) as { id: number; email: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize demo user if it doesn't exist
  const demoUser = await storage.getUserByEmail("demo@chill.com.au");
  if (!demoUser) {
    const hashedPassword = await bcrypt.hash("demo123", 10);
    await storage.createUser({
      username: "demo",
      password: hashedPassword,
      email: "demo@chill.com.au",
      name: "Demo User",
    });

    // Add demo consignments for the demo user
    const user = await storage.getUserByEmail("demo@chill.com.au");
    if (user) {
      await storage.seedDemoConsignments(user.id);
    }
  }

  // Login route
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, {
        expiresIn: "24h",
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get consignments for the authenticated user
  app.get("/api/consignments", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      
      if (!userId || !userEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Check if we should use Axylog API
      if (USE_AXYLOG_API) {
        // Use Axylog API to get consignments
        console.log(`Fetching consignments from Axylog API for user email: ${userEmail}`);
        
        const consignments = await axylogAPI.getDeliveries(userEmail);
        
        // Update user ID for each consignment
        const consignmentsWithUserId = consignments.map(c => ({
          ...c,
          userId
        }));
        
        res.json(consignmentsWithUserId);
      } else {
        // Use demo data
        console.log(`Using demo consignments for user ID: ${userId}`);
        const consignments = await storage.getConsignmentsByUserId(userId);
        res.json(consignments);
      }
    } catch (error) {
      console.error("Error fetching consignments:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get a specific consignment by ID
  app.get("/api/consignments/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const consignmentId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // For now, we're only using demo data for individual consignment details
      // as the Axylog API may not provide individual consignment retrieval
      const consignment = await storage.getConsignmentById(consignmentId);
      
      if (!consignment) {
        return res.status(404).json({ message: "Consignment not found" });
      }
      
      if (consignment.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(consignment);
    } catch (error) {
      console.error("Error fetching consignment:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Something went wrong" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
