-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger function
CREATE OR REPLACE FUNCTION notify_orders_change()
RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload = row_to_json(OLD);
  ELSE
    payload = row_to_json(NEW);
  END IF;
  PERFORM pg_notify('orders_changes', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS orders_notify_trigger ON orders;
CREATE TRIGGER orders_notify_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_orders_change();

-- Sample data
INSERT INTO orders (customer_name, product_name, status, updated_at)
VALUES ('Piyush', 'Laptop', 'pending', NOW()),
       ('Rahul', 'Phone', 'pending', NOW()),
       ('Sara', 'Keyboard', 'shipped', NOW());
