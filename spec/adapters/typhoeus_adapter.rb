class TyphoeusAdapter < HTTPBaseAdapter

  def send_get_request
    #response = Typhoeus.get(parse_uri.to_s, headers: @headers, params: @data)
    hydra = Typhoeus::Hydra.new
    hydra.queue(Typhoeus::Request.new(parse_uri.to_s, headers: @headers, params: @data))
    hydra.run
  end

  def send_post_request
    Typhoeus.post(parse_uri.to_s, body: query_string, headers: @headers)
  end

  def send_post_form_request
    Typhoeus.post(parse_uri.to_s, body: @params, headers: @headers)
  end

  def send_multipart_post_request
    send_post_form_request
  end

  def self.is_libcurl?
    true
  end
end
